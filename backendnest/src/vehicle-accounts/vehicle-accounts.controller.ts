import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Ip,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VehicleAccountsService } from './vehicle-accounts.service';
import {
  TopUpDto,
  LinkCardDto,
  BlockCardDto,
  ReplaceCardDto,
  AdjustBalanceDto,
  UpdateAccountStatusDto,
  UpdatePenaltyConfigDto,
} from './dto/vehicle-account.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('vehicle-accounts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VehicleAccountsController {
  constructor(private readonly service: VehicleAccountsService) {}

  /**
   * Fast Search for Top-Up Officer (Search by plate, cardUid, or cardNumber)
   */
  @Get('search')
  @RequirePermissions('vehicle_account.view')
  search(@Query('q') q: string) {
    return this.service.search(q);
  }

  /**
   * System-wide summary statistics
   */
  @Get('stats/summary')
  @RequirePermissions('vehicle_account.view')
  getStatsSummary() {
    return this.service.getStatsSummary();
  }

  /**
   * Penalty Configuration
   */
  @Get('penalty-config')
  @RequirePermissions('vehicle_account.view')
  getPenaltyConfig() {
    return this.service.getPenaltyConfig();
  }

  @Put('penalty-config')
  @RequirePermissions('fees.manage')
  updatePenaltyConfig(
    @Body() dto: UpdatePenaltyConfigDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.service.updatePenaltyConfig(dto, user, ip);
  }

  /**
   * Cards Management
   */
  @Get('cards')
  @RequirePermissions('card.view')
  getCards(
    @Query() query: QueryParamsDto & { vehicleId?: string; status?: string },
  ) {
    return this.service.getCards(query);
  }

  @Post('cards/link')
  @RequirePermissions('card.assign')
  linkCard(
    @Body() dto: LinkCardDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.service.linkCard(dto, user, ip);
  }

  @Post('cards/:cardId/block')
  @RequirePermissions('card.block')
  blockCard(
    @Param('cardId') cardId: string,
    @Body() dto: BlockCardDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.service.blockCard(cardId, dto.reason, user, ip);
  }

  @Post('cards/:cardId/lost')
  @RequirePermissions('card.block')
  markCardLost(
    @Param('cardId') cardId: string,
    @Body() dto: BlockCardDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.service.markCardLost(cardId, dto.reason, user, ip);
  }

  @Post('cards/replace')
  @RequirePermissions('card.replace')
  replaceCard(
    @Body() dto: ReplaceCardDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.service.replaceCard(dto, user, ip);
  }

  /**
   * Transactions Ledger
   */
  @Get('transactions')
  @RequirePermissions('transaction.view')
  getTransactions(
    @Query()
    query: QueryParamsDto & {
      vehicleId?: string;
      plateNumber?: string;
      type?: string;
      paymentMethod?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.service.getTransactions(query);
  }

  /**
   * Process Balance Top-Up
   */
  @Post('top-up')
  @RequirePermissions('topup.create')
  @HttpCode(HttpStatus.OK)
  topUp(
    @Body() dto: TopUpDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.service.topUp(dto, user, ip);
  }

  /**
   * List Paginated Vehicle Accounts
   */
  @Get()
  @RequirePermissions('vehicle_account.view')
  listAccounts(
    @Query()
    query: QueryParamsDto & {
      status?: string;
      hasDebt?: boolean;
      groupId?: string;
      plateNumber?: string;
    },
  ) {
    return this.service.listAccounts(query);
  }

  /**
   * Single Vehicle Account Details
   */
  @Get(':idOrVehicleId')
  @RequirePermissions('vehicle_account.view')
  getAccountById(@Param('idOrVehicleId') idOrVehicleId: string) {
    return this.service.getAccountByIdOrVehicleId(idOrVehicleId);
  }

  /**
   * Supervisor/Admin Manual Balance Adjustment
   */
  @Post(':vehicleId/adjust-balance')
  @RequirePermissions('override.operational')
  adjustBalance(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: AdjustBalanceDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.service.adjustBalance(vehicleId, dto, user, ip);
  }

  /**
   * Update Account Status (ACTIVE, SUSPENDED, BLOCKED, OUTSTANDING_DEBT)
   */
  @Post(':vehicleId/status')
  @RequirePermissions('vehicles.manage')
  updateAccountStatus(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: UpdateAccountStatusDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
  ) {
    return this.service.updateAccountStatus(vehicleId, dto, user, ip);
  }
}

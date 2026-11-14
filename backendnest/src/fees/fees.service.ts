import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeeRuleDto, UpdateFeeRuleDto } from './dto/create-fee-rule.dto';

@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRule(r: any) {
    return { id: r.id, name: r.name, amount: r.amount, currency: r.currency, vehicleType: r.vehicleType, active: r.active, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
  }

  async list() {
    const rules = await this.prisma.dispatchFeeRule.findMany({ orderBy: { vehicleType: 'asc' } });
    return rules.map(this.mapRule);
  }

  async create(dto: CreateFeeRuleDto) {
    const r = await this.prisma.dispatchFeeRule.create({ data: { name: dto.name, amount: dto.amount, currency: dto.currency || 'ETB', vehicleType: dto.vehicleType, active: dto.active ?? true } });
    return this.mapRule(r);
  }

  async update(id: string, dto: UpdateFeeRuleDto) {
    const rule = await this.prisma.dispatchFeeRule.findUnique({ where: { id } });
    if (!rule) throw new HttpException('Fee rule not found.', HttpStatus.NOT_FOUND);
    const r = await this.prisma.dispatchFeeRule.update({ where: { id }, data: { ...dto } });
    return this.mapRule(r);
  }

  async delete(id: string) {
    const rule = await this.prisma.dispatchFeeRule.findUnique({ where: { id } });
    if (!rule) throw new HttpException('Fee rule not found.', HttpStatus.NOT_FOUND);
    await this.prisma.dispatchFeeRule.delete({ where: { id } });
    return { success: true };
  }
}

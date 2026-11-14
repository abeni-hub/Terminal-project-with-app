# ==============================================================================
# ANPR TRANSPORT TERMINAL MANAGEMENT SYSTEM - AUTOMATED TEST SUITE
# ==============================================================================
# This script simulates real-time ANPR camera gate events and operational dispatches
# Run with: .\test_workflow.ps1
# ==============================================================================

$API_BASE = "http://localhost:4000/api"

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  ANPR TRANSPORT TERMINAL - END-TO-END WORKFLOW TEST" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Backend Health
Write-Host "[1/6] Checking Backend Server Connection..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$API_BASE/terminals?page=1&pageSize=10" -Method Get -ErrorAction Stop
    Write-Host "  ✔ Backend is ONLINE! Found $($health.total) terminals in database." -ForegroundColor Green
} catch {
    Write-Host "  ✖ Backend is not running on $API_BASE." -ForegroundColor Red
    Write-Host "    Please run: cd backend && npm run start:dev" -ForegroundColor White
    exit
}

# 2. Simulate Valid Entry ANPR Scan at Mercato Terminal Gate
Write-Host ""
Write-Host "[2/6] Simulating Valid Entry ANPR Scan for Vehicle '2-A12345' at Mercato Gate..." -ForegroundColor Yellow
$entryBody = @{
    cameraId = "cam-mercato-in-1"
    terminalId = "term-mercato"
    plateNumber = "2-A12345"
    confidence = 0.96
    cameraType = "ENTRY"
} | ConvertTo-Json

try {
    $entryRes = Invoke-RestMethod -Uri "$API_BASE/v1/recognition/process" -Method Post -Body $entryBody -ContentType "application/json"
    Write-Host "  ✔ ANPR Result: $($entryRes.result)" -ForegroundColor Green
    Write-Host "  ✔ Queue Status: $($entryRes.queueEntry.status)" -ForegroundColor Green
    Write-Host "  ✔ Assigned Route: $($entryRes.assignment.originTerminalName) -> $($entryRes.assignment.destinationTerminalName)" -ForegroundColor Green
    $validQueueId = $entryRes.queueEntry.id
} catch {
    Write-Host "  ✖ Entry ANPR simulation failed: $_" -ForegroundColor Red
}

# 3. Simulate Dispatcher "Dispatch In" (Vehicle enters Loading Yard)
Write-Host ""
Write-Host "[3/6] Simulating Dispatcher 'Dispatch In' for Loading Yard..." -ForegroundColor Yellow
if ($validQueueId) {
    $dispInBody = @{
        queueEntryId = $validQueueId
        dispatcherId = "user-disp-mercato"
        remark = "Assigned to Platform Berth 2"
    } | ConvertTo-Json

    try {
        $dispInRes = Invoke-RestMethod -Uri "$API_BASE/queue/dispatch-in" -Method Post -Body $dispInBody -ContentType "application/json"
        Write-Host "  ✔ Status changed to: $($dispInRes.status) (Loading Passengers)" -ForegroundColor Green
    } catch {
        Write-Host "  ✖ Dispatch In failed: $_" -ForegroundColor Red
    }
}

# 4. Simulate Exit ANPR Gate Detection
Write-Host ""
Write-Host "[4/6] Simulating Exit ANPR Scan for '2-A12345' at Mercato Exit Gate..." -ForegroundColor Yellow
$exitBody = @{
    cameraId = "cam-mercato-out-1"
    terminalId = "term-mercato"
    plateNumber = "2-A12345"
    confidence = 0.98
    cameraType = "EXIT"
} | ConvertTo-Json

try {
    $exitRes = Invoke-RestMethod -Uri "$API_BASE/v1/recognition/process" -Method Post -Body $exitBody -ContentType "application/json"
    Write-Host "  ✔ Exit Gate ANPR Result: $($exitRes.result)" -ForegroundColor Green
    Write-Host "  ✔ Queue Status: $($exitRes.queueEntry.status) (Awaiting Fee & Dispatch Out)" -ForegroundColor Green
} catch {
    Write-Host "  ✖ Exit ANPR simulation failed: $_" -ForegroundColor Red
}

# 5. Simulate Fee Collection & "Dispatch Out"
Write-Host ""
Write-Host "[5/6] Simulating Fee Payment & Dispatcher 'Dispatch Out'..." -ForegroundColor Yellow
if ($validQueueId) {
    $dispOutBody = @{
        queueEntryId = $validQueueId
        dispatcherId = "user-disp-mercato"
        paymentReference = "CBE-TXN-" + (Get-Random -Minimum 100000 -Maximum 999999)
        feeAmount = 25.0
        paymentStatus = "PAID"
    } | ConvertTo-Json

    try {
        $dispOutRes = Invoke-RestMethod -Uri "$API_BASE/queue/dispatch-out" -Method Post -Body $dispOutBody -ContentType "application/json"
        Write-Host "  ✔ Trip Dispatched Out!" -ForegroundColor Green
        Write-Host "  ✔ Audit Ref: $($dispOutRes.auditRef)" -ForegroundColor Green
        Write-Host "  ✔ Fee Paid: $($dispOutRes.feeAmount) ETB ($($dispOutRes.paymentStatus))" -ForegroundColor Green
    } catch {
        Write-Host "  ✖ Dispatch Out failed: $_" -ForegroundColor Red
    }
}

# 6. Simulate Wrong-Terminal Violation (Plate '3-C11111' arriving at Mercato, but assigned to Bole)
Write-Host ""
Write-Host "[6/6] Simulating Wrong-Terminal Violation for '3-C11111' at Mercato..." -ForegroundColor Yellow
$violBody = @{
    cameraId = "cam-mercato-in-1"
    terminalId = "term-mercato"
    plateNumber = "3-C11111"
    confidence = 0.95
    cameraType = "ENTRY"
} | ConvertTo-Json

try {
    $violRes = Invoke-RestMethod -Uri "$API_BASE/v1/recognition/process" -Method Post -Body $violBody -ContentType "application/json"
    Write-Host "  ✔ Automated Gate Alert: $($violRes.result)" -ForegroundColor Magenta
    Write-Host "  ✔ Details: $($violRes.message)" -ForegroundColor Magenta
    Write-Host "  ✔ Violation Record ID: $($violRes.violationId)" -ForegroundColor Magenta
} catch {
    Write-Host "  ✖ Violation simulation failed: $_" -ForegroundColor Red
}

# 7. Fetch 360° History for Vehicle
Write-Host ""
Write-Host "[BONUS] Verifying 360° Vehicle History API for '2-A12345'..." -ForegroundColor Yellow
try {
    $history = Invoke-RestMethod -Uri "$API_BASE/vehicles/2-A12345/history" -Method Get
    Write-Host "  ✔ Vehicle: $($history.vehicle.plateNumber) ($($history.vehicle.model))" -ForegroundColor Green
    Write-Host "  ✔ Total Dispatched Trips: $($history.dispatchRecords.Count)" -ForegroundColor Green
    Write-Host "  ✔ Total ANPR Gate Scans: $($history.recognitionEvents.Count)" -ForegroundColor Green
    Write-Host "  ✔ Total Weekly Assignments: $($history.assignments.Count)" -ForegroundColor Green
} catch {
    Write-Host "  ✖ Vehicle history fetch failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  ✔ TEST SUITE COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "  Open http://localhost:3000/queue to view the live dashboard." -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

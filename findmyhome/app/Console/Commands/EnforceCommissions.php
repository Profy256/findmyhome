<?php

namespace App\Console\Commands;

use App\Services\CommissionEnforcementService;
use Illuminate\Console\Command;

class EnforceCommissions extends Command
{
    protected $signature   = 'commissions:enforce';
    protected $description = 'Check overdue commissions, send reminders, and block sellers on 3rd unpaid reminder';

    public function handle(CommissionEnforcementService $service): int
    {
        $this->info('Running commission enforcement...');
        $service->processOverdueCommissions();
        $this->info('Done.');
        return Command::SUCCESS;
    }
}

<?php

use Illuminate\Support\Facades\Schedule;

// ── Commission enforcement runs every day at 8:00 AM Uganda time (EAT = UTC+3)
Schedule::command('commissions:enforce')->dailyAt('05:00'); // 05:00 UTC = 08:00 EAT

// ── Clean up expired tokens weekly
Schedule::command('sanctum:prune-expired --hours=24')->weekly();

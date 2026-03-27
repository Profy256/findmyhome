<?php

namespace App\Jobs;

use App\Models\KycDocument;
use App\Services\KycAiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class AnalyseKycDocument implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Retry up to 2 times if Google Vision fails
    public int $tries = 2;

    // Wait 30 seconds before retrying
    public int $backoff = 30;

    // Timeout after 60 seconds
    public int $timeout = 60;

    public function __construct(public KycDocument $document) {}

    public function handle(KycAiService $service): void
    {
        $service->analyse($this->document);
    }

    public function failed(\Throwable $e): void
    {
        // If job fails completely after retries — flag for manual admin review
        $this->document->update([
            'review_note' => 'AI analysis job failed after retries. Manual review required.',
        ]);

        \Illuminate\Support\Facades\Log::error("KYC analysis job failed permanently", [
            'document_id' => $this->document->id,
            'error'       => $e->getMessage(),
        ]);
    }
}

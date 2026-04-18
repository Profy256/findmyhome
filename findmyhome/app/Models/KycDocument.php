<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class KycDocument extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'document_type', 'file_url',
        'cloudinary_public_id', 'status',
        'rejection_reason', 'reviewed_by', 'reviewed_at',
        'review_note',
        'ai_confidence_score', 'ai_checks', 'ai_extracted_text',
        'ai_analysed_at', 'ai_auto_decided',
    ];

    protected $casts = [
        'reviewed_at'        => 'datetime',
        'ai_analysed_at'     => 'datetime',
        'ai_auto_decided'    => 'boolean',
        'ai_checks'          => 'array',
        'ai_confidence_score'=> 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function approve(User $admin): void
    {
        $this->update([
            'status'      => 'verified',
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);
        $this->user->update(['kyc_status' => 'verified']);
    }

    public function reject(User $admin, string $reason): void
    {
        $this->update([
            'status'           => 'rejected',
            'rejection_reason' => $reason,
            'reviewed_by'      => $admin->id,
            'reviewed_at'      => now(),
        ]);
        $this->user->update(['kyc_status' => 'rejected']);
    }
}

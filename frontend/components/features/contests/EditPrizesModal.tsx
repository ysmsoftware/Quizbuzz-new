'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface PrizeBracketDraft {
    rankFrom: number;
    rankTo: number;
    amount: number;
    currency: string;
    label: string;
    benefits: string[];
}

interface RawPrize {
    rankFrom: number;
    rankTo: number;
    amount: number | string;
    currency?: string;
    label?: string | null;
    benefits?: string[];
}

interface EditPrizesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    prizes: RawPrize[];
    onSave: (prizes: PrizeBracketDraft[]) => Promise<void>;
}

export function EditPrizesModal({ open, onOpenChange, prizes, onSave }: EditPrizesModalProps) {
    const [drafts, setDrafts] = useState<PrizeBracketDraft[]>([]);
    const [benefitInputs, setBenefitInputs] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setDrafts(
                (prizes || []).map((p) => ({
                    rankFrom: p.rankFrom,
                    rankTo: p.rankTo,
                    amount: Number(p.amount) || 0,
                    currency: p.currency || 'INR',
                    label: p.label || '',
                    benefits: p.benefits || [],
                }))
            );
            setBenefitInputs({});
        }
    }, [open, prizes]);

    const handleAddBracket = () => {
        setDrafts((prev) => [
            ...prev,
            {
                rankFrom: prev.length + 1,
                rankTo: prev.length + 1,
                amount: 0,
                currency: 'INR',
                label: '',
                benefits: [],
            },
        ]);
    };

    const handleRemoveBracket = (index: number) => {
        setDrafts((prev) => prev.filter((_, i) => i !== index));
    };

    const handleFieldChange = (index: number, field: keyof PrizeBracketDraft, value: any) => {
        setDrafts((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleAddBenefit = (index: number) => {
        const value = (benefitInputs[index] || '').trim();
        if (!value) return;
        setDrafts((prev) => {
            const next = [...prev];
            if (!next[index].benefits.includes(value)) {
                next[index] = { ...next[index], benefits: [...next[index].benefits, value] };
            }
            return next;
        });
        setBenefitInputs((prev) => ({ ...prev, [index]: '' }));
    };

    const handleRemoveBenefit = (index: number, benefitIndex: number) => {
        setDrafts((prev) => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                benefits: next[index].benefits.filter((_, i) => i !== benefitIndex),
            };
            return next;
        });
    };

    const isValid = drafts.every((d) => d.rankTo >= d.rankFrom && d.amount >= 0);

    const handleSaveClick = async () => {
        if (!isValid) return;
        setSaving(true);
        try {
            await onSave(drafts);
            onOpenChange(false);
        } catch {
            // Error toast is handled by the caller; keep modal open so the admin can retry.
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Prize Structure</DialogTitle>
                    <DialogDescription>
                        Update existing prize brackets or add new ones. Changes are saved once you confirm below.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {drafts.length} bracket{drafts.length === 1 ? '' : 's'} defined
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={handleAddBracket} className="gap-1">
                            <Plus className="h-4 w-4" /> Add Bracket
                        </Button>
                    </div>

                    {drafts.length === 0 ? (
                        <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground text-xs">
                            No prize brackets yet. Click "Add Bracket" to create one.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {drafts.map((prize, idx) => (
                                <Card key={idx} className="border-border/60 bg-muted/5 relative">
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveBracket(idx)}
                                        className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                    <CardHeader className="pb-3 pr-10">
                                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Prize Bracket #{idx + 1}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-semibold mb-1 block text-muted-foreground">Label (e.g. Gold, Winner)</label>
                                                <Input
                                                    value={prize.label}
                                                    onChange={(e) => handleFieldChange(idx, 'label', e.target.value)}
                                                    placeholder="Gold Winner"
                                                    className="h-8 text-xs"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-semibold mb-1 block text-muted-foreground">Rank From *</label>
                                                    <Input
                                                        type="number"
                                                        value={prize.rankFrom}
                                                        onChange={(e) => handleFieldChange(idx, 'rankFrom', Number(e.target.value))}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-semibold mb-1 block text-muted-foreground">Rank To *</label>
                                                    <Input
                                                        type="number"
                                                        value={prize.rankTo}
                                                        onChange={(e) => handleFieldChange(idx, 'rankTo', Number(e.target.value))}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-semibold mb-1 block text-muted-foreground">Prize Amount</label>
                                                <Input
                                                    type="number"
                                                    value={prize.amount}
                                                    onChange={(e) => handleFieldChange(idx, 'amount', Number(e.target.value))}
                                                    placeholder="5000"
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-semibold mb-1 block text-muted-foreground">Currency</label>
                                                <Select
                                                    value={prize.currency}
                                                    onValueChange={(val) => handleFieldChange(idx, 'currency', val)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                                        <SelectItem value="USD">USD ($)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold block text-muted-foreground">Benefits / Perks</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={benefitInputs[idx] || ''}
                                                    onChange={(e) => setBenefitInputs((prev) => ({ ...prev, [idx]: e.target.value }))}
                                                    placeholder="e.g. Intern Opportunity, Trophy"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddBenefit(idx);
                                                        }
                                                    }}
                                                    className="h-8 text-xs"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs"
                                                    onClick={() => handleAddBenefit(idx)}
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {prize.benefits.map((benefit, benefitIdx) => (
                                                    <Badge
                                                        key={benefitIdx}
                                                        variant="outline"
                                                        className="text-[10px] bg-background flex items-center gap-1 pr-1 py-0.5"
                                                    >
                                                        <span>{benefit}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveBenefit(idx, benefitIdx)}
                                                            className="text-muted-foreground hover:text-destructive rounded-full"
                                                        >
                                                            <X className="h-2 w-2" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        {prize.rankTo < prize.rankFrom && (
                                            <p className="text-[10px] text-destructive font-medium">Rank To must be greater than or equal to Rank From.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSaveClick} disabled={saving || !isValid} className="gap-2">
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {saving ? 'Saving...' : 'Confirm Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

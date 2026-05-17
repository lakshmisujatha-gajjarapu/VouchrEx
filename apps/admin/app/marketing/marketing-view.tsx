'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { createPromotion, deletePromotion } from '@/lib/api';
import { Trash2, Plus, Zap } from 'lucide-react';

interface Promotion {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  category: string | null;
  minInventory: number;
  pushMessage: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MarketingViewProps {
  readonly initialAvailability: { category: string; count: number }[];
  readonly initialPromotions: Promotion[];
}

export default function MarketingView({ initialAvailability, initialPromotions }: MarketingViewProps) {
  const [promotions, setPromotions] = useState<Promotion[]>(initialPromotions);
  const [availability] = useState(initialAvailability);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newPromo, setNewPromo] = useState({
    name: '',
    startTime: '17:15',
    endTime: '21:00',
    category: 'Food',
    minInventory: 2,
    pushMessage: 'Dinner deals are live! 🍜',
  });

  const handleAdd = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createPromotion(newPromo) as Promotion;
      setPromotions([created, ...promotions]);
      setShowAddForm(false);
    } catch {
      alert('Failed to create promotion');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this promotion?')) return;
    try {
      await deletePromotion(id);
      setPromotions(promotions.filter((p) => p.id !== id));
    } catch {
      alert('Failed to delete promotion');
    }
  };

  return (
    <div className="space-y-8">
      {/* Availability Grid */}
      <section>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Live Deal Availability
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {availability.map((item) => (
            <Card key={item.category} className="p-4 flex justify-between items-center bg-surface-high border-none">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{item.category}</p>
                <p className="text-2xl font-bold">{item.count}</p>
              </div>
              <div className={`px-2 py-1 rounded text-[10px] font-bold ${item.count >= 2 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                {item.count >= 2 ? 'PUSH READY' : 'LOW STOCK'}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Promotion Windows */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Active Promotion Windows</h2>
          <Button size="sm" onClick={() => { setShowAddForm(!showAddForm); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Window
          </Button>
        </div>

        {showAddForm && (
          <Card className="p-6 mb-6 bg-surface-high border-none">
            <form 
              onSubmit={(e) => { void handleAdd(e); }} 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">Name</label>
                <Input value={newPromo.name} onChange={(e) => { setNewPromo({ ...newPromo, name: e.target.value }); }} placeholder="e.g. Dinner Push" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">Category</label>
                <Input value={newPromo.category} onChange={(e) => { setNewPromo({ ...newPromo, category: e.target.value }); }} placeholder="e.g. Food" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">Min Inventory</label>
                <Input type="number" value={newPromo.minInventory} onChange={(e) => { setNewPromo({ ...newPromo, minInventory: Number.parseInt(e.target.value, 10) }); }} required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">Start Time (HH:MM)</label>
                <Input value={newPromo.startTime} onChange={(e) => { setNewPromo({ ...newPromo, startTime: e.target.value }); }} placeholder="17:15" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">End Time (HH:MM)</label>
                <Input value={newPromo.endTime} onChange={(e) => { setNewPromo({ ...newPromo, endTime: e.target.value }); }} placeholder="21:00" required />
              </div>
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <label className="text-xs font-bold uppercase">Push Message</label>
                <Input value={newPromo.pushMessage} onChange={(e) => { setNewPromo({ ...newPromo, pushMessage: e.target.value }); }} placeholder="Tonight's dinner deals are live..." required />
              </div>
              <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => { setShowAddForm(false); }}>Cancel</Button>
                <Button type="submit" disabled={loading}>Save Window</Button>
              </div>
            </form>
          </Card>
        )}

        <div className="space-y-4">
          {promotions.map((promo) => (
            <Card key={promo.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-high border-none">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg">{promo.name}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">{promo.category}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {promo.startTime} – {promo.endTime} · Min inventory: {promo.minInventory}
                </p>
                <p className="text-xs bg-black/10 dark:bg-white/5 p-2 rounded mt-3 italic">
                  "{promo.pushMessage}"
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => { void handleDelete(promo.id); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
          {promotions.length === 0 && (
            <div className="text-center py-12 bg-surface-high rounded-xl text-muted-foreground italic">
              No active promotion windows configured.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

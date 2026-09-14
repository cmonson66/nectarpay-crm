'use client';

/**
 * Network Harvesting Form
 * 
 * New rep lists personal merchant relationships: coffee shops, tattoo places, favorite restaurants, etc.
 * System matches against nearby crypto-accepting merchants from your vertical database.
 * Creates warm leads for Day 1 outreach.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Zap, ChevronRight } from 'lucide-react';

const VERTICALS = [
  { id: 'coffee', label: 'Coffee Shops', icon: '☕' },
  { id: 'tattoo', label: 'Tattoo Shops', icon: '🎨' },
  { id: 'restaurants', label: 'Restaurants', icon: '🍽️' },
  { id: 'gyms', label: 'Gyms & Fitness', icon: '💪' },
  { id: 'barbers', label: 'Barbers & Hair', icon: '✂️' },
  { id: 'nail', label: 'Nail Salons', icon: '💅' },
  { id: 'auto', label: 'Auto Shops', icon: '🚗' },
  { id: 'bike', label: 'Bike Shops', icon: '🚲' },
  { id: 'phone', label: 'Phone Repair', icon: '📱' },
  { id: 'med-spa', label: 'Med Spas', icon: '💆' },
  { id: 'smoke', label: 'Smoke/Vape', icon: '💨' },
  { id: 'game', label: 'Gaming/Arcades', icon: '🎮' },
  { id: 'sports-bar', label: 'Sports Bars', icon: '🍺' },
  { id: 'thrift', label: 'Thrift Shops', icon: '👕' },
  { id: 'music', label: 'Music Studios', icon: '🎵' },
  { id: 'yoga', label: 'Yoga/Wellness', icon: '🧘' },
  { id: 'collectibles', label: 'Collectibles', icon: '🎁' },
  { id: 'sneakers', label: 'Sneaker Shops', icon: '👟' },
  { id: 'dispensary', label: 'Dispensaries', icon: '🌿' },
  { id: 'car-wash', label: 'Car Wash', icon: '🚿' },
];

export interface NetworkData {
  coffee: string;
  tattoo: string;
  restaurants: string;
  gyms: string;
  barbers: string;
  nail: string;
  auto: string;
  bike: string;
  phone: string;
  [key: string]: string;
}

interface FormProps {
  onSubmit?: (data: NetworkData) => void;
  onMatchesFound?: (matches: any[]) => void;
}

export function NetworkHarvestingForm({ onSubmit, onMatchesFound }: FormProps) {
  const [data, setData] = useState<NetworkData>({
    coffee: '',
    tattoo: '',
    restaurants: '',
    gyms: '',
    barbers: '',
    nail: '',
    auto: '',
    bike: '',
    phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    
    // Simulate matching against nearby merchants
    // In production, this queries your crypto_signals + vertical classification
    const filledCategories = Object.values(data).filter(v => v.trim().length > 0).length;
    const estimatedMatches = filledCategories * 3; // ~3 nearby per category typically
    
    setMatchCount(estimatedMatches);
    
    if (onSubmit) {
      onSubmit(data);
    }
    
    // Simulate API delay
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  const filledCount = Object.values(data).filter(v => v.trim().length > 0).length;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-8">
        <h1 className="font-display text-2xl tracking-wider mb-2">Where You Already Buy</h1>
        <p className="text-muted-foreground mb-6">
          List places you actually go: coffee shops, tattoo places, restaurants where you eat. 
          We'll match those against nearby merchants already using crypto to find your warm leads for Day 1.
        </p>

        {submitted && (
          <Card className="p-4 mb-6 bg-emerald-500/5 border-emerald-500/20">
            <div className="flex gap-3">
              <Zap className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-emerald-600">Network saved!</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Found {matchCount} warm leads based on your personal merchant network. 
                  Add these to your territory and reach out first.
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {VERTICALS.map(vertical => (
          <div key={vertical.id} className="space-y-2">
            <Label htmlFor={vertical.id} className="flex items-center gap-2">
              <span className="text-lg">{vertical.icon}</span>
              {vertical.label}
            </Label>
            <Textarea
              id={vertical.id}
              placeholder={`e.g., Bluebird Cafe, Corvus Coffee`}
              value={data[vertical.id] || ''}
              onChange={(e) => handleChange(vertical.id, e.target.value)}
              className="h-20 text-sm resize-none"
            />
            {data[vertical.id] && (
              <div className="text-xs text-emerald-600">
                ✓ {data[vertical.id].split(',').filter(s => s.trim()).length} place{data[vertical.id].split(',').filter(s => s.trim()).length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary & Submit */}
      <Card className="p-6 mb-6 bg-blue-500/5 border-blue-500/20">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="font-semibold">{filledCount} categories filled</div>
            <div className="text-sm text-muted-foreground">
              Each filled category → ~3 warm leads near you
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">~{filledCount * 3}</div>
            <div className="text-xs text-muted-foreground">estimated warm leads</div>
          </div>
        </div>
      </Card>

      {/* Call to Action */}
      <Button
        onClick={handleSubmit}
        disabled={filledCount === 0 || submitting}
        className="w-full"
        size="lg"
      >
        {submitting ? 'Matching merchants...' : `Match My Network → Find ${filledCount * 3} Leads`}
        <ChevronRight className="ml-2 w-4 h-4" />
      </Button>

      {/* Instructions */}
      <Card className="mt-8 p-6 bg-muted/30">
        <h3 className="font-semibold mb-3">How This Works</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li><span className="font-medium">1. You list where you go</span> — coffee, tattoo, gym, wherever</li>
          <li><span className="font-medium">2. We find crypto merchants nearby</span> — same neighborhood, same vertical</li>
          <li><span className="font-medium">3. You reach out first</span> — "I saw you there, I'm in the area with crypto payments"</li>
          <li><span className="font-medium">4. Personal connection wins</span> — "I get coffee there too" opens doors that cold calls don't</li>
        </ol>
      </Card>

      {/* Best Practices */}
      <Card className="mt-6 p-6 bg-amber-500/5 border-amber-500/20">
        <h3 className="font-semibold mb-3 flex gap-2">
          <span>⭐ Best Practices</span>
        </h3>
        <ul className="space-y-2 text-sm">
          <li>• <span className="font-medium">Be specific:</span> "Bluebird Cafe" not "coffee places"</li>
          <li>• <span className="font-medium">Go deep in 2-3 categories</span> rather than shallow in all 20</li>
          <li>• <span className="font-medium">Update your network monthly</span> as you discover new places</li>
          <li>• <span className="font-medium">The strongest leads are personal</span> — places you actually go matters</li>
        </ul>
      </Card>
    </div>
  );
}

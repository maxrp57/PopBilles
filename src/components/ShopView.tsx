import React, { useState } from 'react';
import { Check, Coins, Sparkles, Tag } from 'lucide-react';
import { SHOP_ITEMS } from '../data/catalog';
import {
  AccessoryId,
  EquippedCosmetics,
  ShopItem,
  SkinId,
  ThemeId,
} from '../types/game';
import { BallPortrait } from './BallPortrait';

interface ShopViewProps {
  coins: number;
  ownedItems: string[];
  equipped: EquippedCosmetics;
  onBuyAndEquip: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
  onRedeemPromoCode: (code: string) => { ok: boolean; message: string };
}

const CATEGORIES: { key: ShopItem['category']; label: string }[] = [
  { key: 'skin', label: 'Apparences' },
  { key: 'accessory', label: 'Accessoires' },
  { key: 'theme', label: 'Décors' },
  { key: 'effect', label: 'Effets de fusion' },
];

export const ShopView: React.FC<ShopViewProps> = ({
  coins,
  ownedItems,
  equipped,
  onBuyAndEquip,
  onEquip,
  onRedeemPromoCode,
}) => {
  const [activeCategory, setActiveCategory] = useState<ShopItem['category']>('skin');
  const [promoInput, setPromoInput] = useState('');
  const [promoFeedback, setPromoFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const ownedSet = new Set(ownedItems);
  const items = SHOP_ITEMS.filter((item) => item.category === activeCategory);

  const isEquipped = (item: ShopItem): boolean => {
    if (item.category === 'skin') return equipped.skin === item.itemKey;
    if (item.category === 'accessory') return equipped.accessory === item.itemKey;
    if (item.category === 'theme') return equipped.theme === item.itemKey;
    return equipped.effect === item.itemKey;
  };

  const handlePromoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = promoInput.trim();
    if (!trimmed) return;
    const res = onRedeemPromoCode(trimmed);
    setPromoFeedback(res);
    if (res.ok) {
      setPromoInput('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Boutique Cosmétique</h1>
          <p className="text-sm text-slate-600 mt-1">
            Personnalisez vos boules et votre bocal avec les éclats gagnés à la fin de chaque partie.
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold font-mono-nums">
          <Coins className="w-4 h-4 text-amber-600" />
          <span>{coins} éclats</span>
        </div>
      </div>

      {/* Promo Code Redemption Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Utiliser un code promo</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Entrez un code cadeau pour recevoir des éclats bonus instantanément.
            </p>
            {promoFeedback && (
              <p
                className={`text-xs font-semibold mt-1.5 ${
                  promoFeedback.ok ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {promoFeedback.message}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handlePromoSubmit} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            placeholder="Entrez votre code"
            aria-label="Code promo"
            className="flex-1 sm:w-48 px-3.5 py-2 rounded-xl border border-stone-300 bg-stone-50 text-sm font-mono-nums uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Valider
          </button>
        </form>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-200/70 rounded-xl w-fit">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveCategory(cat.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeCategory === cat.key
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const owned = ownedSet.has(item.id);
          const active = isEquipped(item);
          const canAfford = coins >= item.price;

          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all bg-white ${
                active ? 'border-amber-500 ring-2 ring-amber-200' : 'border-stone-200'
              }`}
            >
              <div>
                <div className="h-28 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-center mb-4 gap-3 overflow-hidden">
                  {item.category === 'skin' && (
                    <>
                      <BallPortrait
                        level={3}
                        size={64}
                        skin={item.itemKey as SkinId}
                        accessory={equipped.accessory}
                        emotion="happy"
                      />
                      <BallPortrait
                        level={4}
                        size={74}
                        skin={item.itemKey as SkinId}
                        accessory={equipped.accessory}
                        emotion="love"
                      />
                    </>
                  )}
                  {item.category === 'accessory' && (
                    <>
                      <BallPortrait
                        level={5}
                        size={68}
                        skin={equipped.skin}
                        accessory={item.itemKey as AccessoryId}
                        emotion="happy"
                      />
                      <BallPortrait
                        level={8}
                        size={78}
                        skin={equipped.skin}
                        accessory={item.itemKey as AccessoryId}
                        emotion="happy"
                      />
                    </>
                  )}
                  {item.category === 'theme' && (
                    <div className="flex items-center gap-3">
                      <div
                        className="w-16 h-20 rounded-lg border-4 shadow-xs"
                        style={{
                          backgroundColor: item.previewColors[0],
                          borderColor: item.previewColors[1],
                        }}
                      />
                      <span className="text-xs font-medium text-slate-500">
                        {(item.itemKey as ThemeId) === 'night' ? 'Fond sombre' : 'Fond lumineux'}
                      </span>
                    </div>
                  )}
                  {item.category === 'effect' && (
                    <div className="flex items-center gap-2">
                      {item.previewColors.map((c, idx) => (
                        <span
                          key={idx}
                          className="w-6 h-6 rounded-full border border-white shadow-xs"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <Sparkles className="w-5 h-5 text-amber-500 ml-1" />
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.description}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between gap-3">
                <div className="text-sm font-bold font-mono-nums text-slate-700">
                  {owned ? 'Débloqué' : `${item.price} éclats`}
                </div>

                {active ? (
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold">
                    <Check className="w-4 h-4" />
                    Équipé
                  </span>
                ) : owned ? (
                  <button
                    type="button"
                    onClick={() => onEquip(item)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Équiper
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyAndEquip(item)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      canAfford
                        ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                        : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                    }`}
                  >
                    Acheter
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

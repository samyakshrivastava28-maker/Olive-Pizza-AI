import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Clock, Flame, SlidersHorizontal, ShoppingBag, Plus, Minus, Check } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

export interface ProductItemData {
  id: string;
  name: string;
  category?: string;
  price: number;
  originalPrice?: number;
  description: string;
  isVeg: boolean;
  image?: string;
  rating?: number;
  reviewsCount?: number;
  prepTime?: string;
  spicyLevel?: number;
  tags?: string[];
  variants?: Array<{ name: string; price: number }>;
  crusts?: Array<{ name: string; price: number }>;
  addons?: Array<{ name: string; price: number }>;
  sizes?: Array<{ name: string; priceMultiplier: number }>;
}

// Audio synthesize effect for in-card click
const playLocalCartChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  } catch {
    // Non-fatal
  }
};

export function ProductCardItem({ product }: { product: ProductItemData }) {
  const [qty, setQty] = useState(1);
  const [selectedSize, setSelectedSize] = useState<'Regular' | 'Medium' | 'Large'>('Medium');
  const [added, setAdded] = useState(false);
  const executeAction = useChatStore((s) => s.executeAction);

  const isPizza =
    product.category?.toLowerCase() === 'pizzas' ||
    product.id.includes('pizza') ||
    product.name.toLowerCase().includes('pizza');

  // Compute unit price based on selected size or variant
  let sizeMultiplier = 1.0;
  if (isPizza) {
    if (selectedSize === 'Regular') sizeMultiplier = 0.8;
    else if (selectedSize === 'Large') sizeMultiplier = 1.4;
  }
  const basePrice = product.price || 349;
  const unitPrice = Math.round(basePrice * sizeMultiplier);
  const originalUnitPrice = product.originalPrice ? Math.round(product.originalPrice * sizeMultiplier) : undefined;
  const totalPrice = unitPrice * qty;

  const discountPercentage = originalUnitPrice && originalUnitPrice > unitPrice
    ? Math.round(((originalUnitPrice - unitPrice) / originalUnitPrice) * 100)
    : 0;

  const rating = (product.rating || 4.8).toFixed(1);

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    playLocalCartChime();
    setAdded(true);

    const actionPayload = {
      type: 'ADD_TO_CART' as const,
      payload: {
        productId: product.id,
        id: product.id,
        name: product.name,
        size: isPizza ? selectedSize : undefined,
        variant: isPizza ? selectedSize : 'Regular',
        crust: 'Classic Hand Tossed',
        unitPrice,
        price: unitPrice,
        quantity: qty,
        totalPrice,
        image: product.image || 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500',
        clientX,
        clientY,
        rect: { x: clientX, y: clientY },
      },
      description: 'Added ' + qty + 'x ' + product.name + (isPizza ? ' (' + selectedSize + ')' : '') + ' to cart for ₹' + totalPrice,
    };

    executeAction(actionPayload);
    setTimeout(() => setAdded(false), 2400);
  };

  const handleCustomize = (e: React.MouseEvent) => {
    e.stopPropagation();
    executeAction({
      type: 'OPEN_PRODUCT',
      payload: {
        productId: product.id,
        name: product.name,
        openCustomizer: true,
      },
      description: 'Customizing ' + product.name,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -4, boxShadow: '0 20px 35px rgba(0,0,0,0.6), 0 0 20px rgba(16,185,129,0.15)' }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      style={{
        width: '100%',
        maxWidth: 360,
        borderRadius: 22,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: 'linear-gradient(165deg, rgba(24, 27, 32, 0.95) 0%, rgba(10, 12, 16, 0.98) 100%)',
        backdropFilter: 'blur(20px)',
        margin: '6px 0',
        position: 'relative',
        boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
      }}
    >
      {/* ── Header Image & Badges ── */}
      <div style={{ position: 'relative', width: '100%', height: 145, background: '#0a0c0f', overflow: 'hidden' }}>
        <motion.img
          src={product.image || 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500'}
          alt={product.name}
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.6 }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* Gradient shadow overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(10,12,16,0.95) 0%, rgba(10,12,16,0.2) 60%, transparent 100%)',
          }}
        />

        {/* Star Rating Badge (Top Left) */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(10, 12, 16, 0.85)',
            backdropFilter: 'blur(10px)',
            padding: '3px 9px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            border: '1px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
          }}
        >
          <Star style={{ width: 12, height: 12, fill: '#F59E0B', color: '#F59E0B' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#FBBF24', fontFamily: 'Inter, sans-serif' }}>
            {rating}
          </span>
        </div>

        {/* Veg/Non-Veg Pure Badge (Top Right) */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'rgba(10, 12, 16, 0.85)',
            backdropFilter: 'blur(10px)',
            padding: '3px 8px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            border: '1px solid rgba(16, 185, 129, 0.35)',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#10B981',
              boxShadow: '0 0 8px #10B981',
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#34D399', letterSpacing: '0.05em' }}>
            100% VEG
          </span>
        </div>

        {/* Discount Badge if available */}
        {discountPercentage > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 10,
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#031b12',
              fontSize: 10,
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: 6,
              letterSpacing: '0.04em',
            }}
          >
            {discountPercentage}% OFF
          </div>
        )}
      </div>

      {/* ── Body Content ── */}
      <div style={{ padding: '12px 14px 14px' }}>
        {/* Title & Price Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
          <h4 style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.3, flex: 1 }}>
            {product.name}
          </h4>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#10B981', fontFamily: 'Inter, sans-serif' }}>
              ₹{unitPrice}
            </span>
            {originalUnitPrice && originalUnitPrice > unitPrice && (
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  textDecoration: 'line-through',
                  marginLeft: 5,
                  display: 'block',
                }}
              >
                ₹{originalUnitPrice}
              </span>
            )}
          </div>
        </div>

        {/* Prep Time & Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock style={{ width: 11, height: 11, color: '#F59E0B' }} />
            {product.prepTime || '15-20 min'}
          </span>
          <span>•</span>
          <span style={{ color: '#34D399', fontWeight: 600 }}>Fresh Dough</span>
          {product.spicyLevel && product.spicyLevel > 0 ? (
            <>
              <span>•</span>
              <span style={{ color: '#F97316', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 700 }}>
                <Flame style={{ width: 10, height: 10 }} />
                Spicy
              </span>
            </>
          ) : null}
        </div>

        {/* Description */}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45, margin: '0 0 10px' }}>
          {product.description}
        </p>

        {/* Size Selection (for pizzas) */}
        {isPizza && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['Regular', 'Medium', 'Large'] as const).map((sz) => {
              const isSelected = selectedSize === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: 10,
                    fontWeight: isSelected ? 800 : 600,
                    fontFamily: 'Inter, sans-serif',
                    background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.04)',
                    color: isSelected ? '#34D399' : 'rgba(255,255,255,0.6)',
                    border: isSelected ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {sz}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Quantity & Action Controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Quantity selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              style={{
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Minus style={{ width: 12, height: 12 }} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 800, minWidth: 20, textAlign: 'center', color: '#fff' }}>
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              style={{
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Plus style={{ width: 12, height: 12 }} />
            </button>
          </div>

          {/* Customize Button */}
          <button
            type="button"
            onClick={handleCustomize}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s',
            }}
          >
            <SlidersHorizontal style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.7)' }} />
            <span>Customize</span>
          </button>

          {/* Add to Cart Animated Button */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={handleAddToCart}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 10,
              background: added
                ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
              border: 'none',
              color: '#021e14',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              boxShadow: added ? '0 0 15px rgba(16,185,129,0.5)' : '0 4px 14px rgba(16,185,129,0.3)',
              transition: 'background 0.3s, box-shadow 0.3s',
            }}
          >
            {added ? (
              <>
                <Check style={{ width: 14, height: 14, strokeWidth: 3 }} />
                <span>Added!</span>
              </>
            ) : (
              <>
                <ShoppingBag style={{ width: 13, height: 13, strokeWidth: 2.5 }} />
                <span>Add ₹{totalPrice}</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

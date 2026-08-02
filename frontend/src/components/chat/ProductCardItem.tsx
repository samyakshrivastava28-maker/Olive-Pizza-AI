import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  sizes?: Array<{ name: string; priceMultiplier: number }>;
}

export function ProductCardItem({ product }: { product: ProductItemData }) {
  const [qty, setQty] = useState(1);
  const [selectedSize, setSelectedSize] = useState<'Regular' | 'Medium' | 'Large'>('Medium');
  const [added, setAdded] = useState(false);
  const executeAction = useChatStore((s) => s.executeAction);

  const isPizza =
    product.category?.toLowerCase() === 'pizzas' ||
    product.id.includes('pizza') ||
    product.name.toLowerCase().includes('pizza');

  // Compute unit price based on selected size
  let sizeMultiplier = 1.0;
  if (isPizza) {
    if (selectedSize === 'Regular') sizeMultiplier = 0.75;
    else if (selectedSize === 'Large') sizeMultiplier = 1.45;
  }
  const unitPrice = Math.round(product.price * sizeMultiplier);
  const totalPrice = unitPrice * qty;

  const handleAddToCart = () => {
    executeAction({
      type: 'ADD_TO_CART',
      payload: {
        productId: product.id,
        name: product.name,
        size: isPizza ? selectedSize : undefined,
        unitPrice,
        price: unitPrice,
        quantity: qty,
        totalPrice,
        image: product.image,
      },
      description: `Added ${qty}x ${product.name} ${isPizza ? `(${selectedSize})` : ''} to cart for ₹${totalPrice}`,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleCustomize = () => {
    executeAction({
      type: 'OPEN_PRODUCT',
      payload: {
        productId: product.id,
        name: product.name,
        openCustomizer: true,
      },
      description: `Customizing ${product.name}`,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(11, 15, 20, 0.6) 100%)',
        maxWidth: 340,
        margin: '8px 0',
      }}
    >
      {/* Header Banner / Image */}
      <div style={{ position: 'relative', height: 130, background: '#121820', overflow: 'hidden' }}>
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              background: 'radial-gradient(circle, rgba(124,111,247,0.15) 0%, rgba(7,9,14,0.9) 100%)',
            }}
          >
            🍕
          </div>
        )}

        {/* Veg / Non-Veg Indicator */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(7,9,14,0.75)',
            backdropFilter: 'blur(8px)',
            padding: '3px 8px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: product.isVeg ? '#22C55E' : '#EF4444',
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 600, color: product.isVeg ? '#4ADE80' : '#F87171' }}>
            {product.isVeg ? 'VEG' : 'NON-VEG'}
          </span>
        </div>

        {/* Rating badge */}
        {product.rating && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'rgba(7,9,14,0.75)',
              backdropFilter: 'blur(8px)',
              padding: '3px 8px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: '#FBBF24',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            ★ {product.rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Body Content */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>{product.name}</h4>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#4ADE80' }}>
              ₹{unitPrice}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.35)',
                  textDecoration: 'line-through',
                  marginLeft: 6,
                }}
              >
                ₹{Math.round(product.originalPrice * sizeMultiplier)}
              </span>
            )}
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#8B8FA8', lineHeight: 1.4, marginBottom: 8 }}>
          {product.description}
        </p>

        {/* Pizza Size Selector */}
        {isPizza && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['Regular', 'Medium', 'Large'] as const).map((sz) => (
              <button
                key={sz}
                onClick={() => setSelectedSize(sz)}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  background: selectedSize === sz ? 'rgba(124,111,247,0.25)' : 'rgba(255,255,255,0.04)',
                  color: selectedSize === sz ? '#c6c0ff' : 'rgba(255,255,255,0.5)',
                  border: selectedSize === sz ? '1px solid rgba(124,111,247,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: selectedSize === sz ? 700 : 400,
                }}
              >
                {sz}
              </button>
            ))}
          </div>
        )}

        {/* Info Tags */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {product.prepTime && (
            <span
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.05)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              ⏱️ {product.prepTime}
            </span>
          )}
          {product.spicyLevel && product.spicyLevel > 0 && (
            <span
              style={{
                fontSize: 10,
                color: '#FB923C',
                background: 'rgba(251,146,60,0.1)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              {'🌶️'.repeat(product.spicyLevel)}
            </span>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {/* Quantity selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              -
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 18, textAlign: 'center' }}>
              {qty}
            </span>
            <button
              onClick={() => setQty(qty + 1)}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              +
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            <button
              onClick={handleCustomize}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#F1F5F9',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Customize
            </button>
            <button
              onClick={handleAddToCart}
              style={{
                flex: 1.2,
                padding: '6px 10px',
                borderRadius: 8,
                background: added ? '#22C55E' : 'linear-gradient(135deg, #7C6FF7 0%, #6355E1 100%)',
                border: 'none',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {added ? '✓ Added' : `Add ₹${totalPrice}`}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

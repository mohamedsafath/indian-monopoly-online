import React, { useMemo } from 'react';
import { BOARD_TILES, COLOR_GROUP_META } from '../../utils/boardTiles';

const fmt = (n) => Number(n ?? 0).toLocaleString('en-IN');

export default function ShortfallPanel({
  me,
  myProperties,
  gameState,
  onMortgage,
  onUnmortgage,
  onSellHouse,
  onSellHotel,
  onTakeLoan,
  onDeclareBankruptcy,
  isMobile = false,
}) {
  if (!me || me.money >= 0) return null;

  const debtRequired = Math.abs(me.money);

  // Group properties check: does any property in this group have buildings?
  const hasBuildingsInGroup = (group) => {
    if (!group) return false;
    const groupTiles = BOARD_TILES.filter(t => t.group === group);
    return groupTiles.some(t => {
      const p = gameState.properties?.[t.id];
      return p && ((p.houses ?? 0) > 0 || p.hotel);
    });
  };

  // Even demolition check: can sell house only if it has the max houses in the color group
  const canSellHouseChecked = (prop, tile) => {
    if (prop.hotel) return false;
    if (prop.houses === 0) return false;
    if (!tile.group) return true;

    const groupTiles = BOARD_TILES.filter(t => t.group === tile.group);
    const ownedGroupProps = groupTiles
      .map(t => gameState.properties?.[t.id])
      .filter(p => p && p.ownerId === me.id);
    
    const maxHouses = Math.max(...ownedGroupProps.map(p => p.houses ?? 0));
    return prop.houses === maxHouses;
  };

  // Even build check: can sell hotel only if it has a hotel
  const canSellHotelChecked = (prop) => {
    return !!prop.hotel;
  };

  // Mortgage checklist items
  const liquidatableAssets = useMemo(() => {
    return myProperties.map(prop => {
      const tile = prop.tile;
      const mortgageVal = tile.mortgage ?? (tile.price ? tile.price / 2 : 0);
      const houseVal = tile.houseCost ? tile.houseCost / 2 : 0;
      
      const hasGroupBuildings = hasBuildingsInGroup(tile.group);
      const eligibleToMortgage = !prop.mortgaged && prop.houses === 0 && !prop.hotel && !hasGroupBuildings;
      const eligibleToSellHouse = canSellHouseChecked(prop, tile);
      const eligibleToSellHotel = canSellHotelChecked(prop);

      return {
        ...prop,
        mortgageVal,
        houseVal,
        eligibleToMortgage,
        eligibleToSellHouse,
        eligibleToSellHotel,
        hasGroupBuildings,
      };
    });
  }, [myProperties, gameState?.properties, me.id]);

  // Calculate maximum potential cash that can be raised
  const totalMaxLiquidation = useMemo(() => {
    let sum = 0;
    liquidatableAssets.forEach(asset => {
      if (!asset.mortgaged) {
        sum += asset.mortgageVal;
      }
      sum += (asset.houses ?? 0) * asset.houseVal;
      if (asset.hotel) {
        sum += 5 * asset.houseVal; // Hotel is equivalent to 5 houses in cost
      }
    });
    // Add loan possibility if active player can borrow
    if (!me.loanActive) {
      sum += 5000;
    }
    return sum;
  }, [liquidatableAssets, me.loanActive]);

  const cannotRaiseEnough = totalMaxLiquidation < debtRequired;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      height: '100%',
      fontFamily: "'DM Sans', sans-serif",
      color: '#f3f4f6',
      padding: isMobile ? '0px' : '4px 0',
    }}>
      {/* Header Info */}
      <div style={{
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1.5px solid rgba(239, 68, 68, 0.35)',
        borderRadius: 14,
        padding: 14,
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(239,68,68,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 16, animation: 'pulse 1s infinite' }}>⚠️</span>
          <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f87171' }}>
            Emergency Cash Required
          </span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444' }}>
          -₹{fmt(debtRequired)}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(209, 213, 219, 0.6)', lineHeight: 1.4 }}>
          {cannotRaiseEnough ? (
            <span style={{ color: '#f87171', fontWeight: 'bold' }}>
              ⚠️ Bankruptcy is imminent. Total assets + loan limit (₹{fmt(totalMaxLiquidation)}) is below shortfall!
            </span>
          ) : (
            `You must raise ₹${fmt(debtRequired)} to end your turn. Max potential: ₹${fmt(totalMaxLiquidation)}.`
          )}
        </div>

        {/* Shortfall Progress Bar */}
        <div style={{
          width: '100%',
          height: 6,
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
          overflow: 'hidden',
          marginTop: 4,
        }}>
          <div style={{
            height: '100%',
            width: '40%', // Fixed red indicator when in debt
            background: '#ef4444',
            boxShadow: '0 0 8px #ef4444',
            borderRadius: 3,
          }} />
        </div>
      </div>

      {/* Property checklist heading */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <h4 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(212,175,55,0.6)' }}>
          Liquidatable Assets ({liquidatableAssets.length})
        </h4>
      </div>

      {/* Checklist list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: isMobile ? 120 : 160,
        paddingRight: 2,
      }}>
        {liquidatableAssets.length === 0 ? (
          <p style={{ fontSize: 11, color: 'rgba(156, 163, 175, 0.4)', textAlign: 'center', marginTop: 16 }}>
            No properties owned. You must borrow or declare bankruptcy.
          </p>
        ) : (
          liquidatableAssets.map(asset => {
            const groupColor = COLOR_GROUP_META[asset.tile.group]?.hex ?? '#9ca3af';
            return (
              <div
                key={asset.id}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${asset.mortgaged ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 12,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Color Group Indicator strip */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: groupColor }} />

                {/* Info row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 6 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {asset.tile.icon} {asset.tile.name}
                      </span>
                      {asset.mortgaged && (
                        <span style={{
                          fontSize: 7, fontWeight: 900, color: '#ef4444',
                          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                          padding: '0px 4px', borderRadius: 3, letterSpacing: '0.04em'
                        }}>
                          MORTGAGED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(156,163,175,0.45)', marginTop: 2 }}>
                      {asset.hotel ? '🏨 Hotel Built' : asset.houses > 0 ? `🏠 Houses: ${asset.houses}/4` : 'Unimproved'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 7, color: 'rgba(156,163,175,0.4)', textTransform: 'uppercase' }}>Mortgage Val</div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24' }}>
                      ₹{fmt(asset.mortgageVal)}
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div style={{ display: 'flex', gap: 6, paddingLeft: 6 }}>
                  {/* Sell houses/hotel */}
                  {(asset.houses > 0 || asset.hotel) && (
                    <button
                      onClick={() => asset.hotel ? onSellHotel(asset.id) : onSellHouse(asset.id)}
                      disabled={!(asset.eligibleToSellHouse || asset.eligibleToSellHotel)}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 'bold',
                        cursor: (asset.eligibleToSellHouse || asset.eligibleToSellHotel) ? 'pointer' : 'not-allowed',
                        background: (asset.eligibleToSellHouse || asset.eligibleToSellHotel) ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.02)',
                        border: `1.5px solid rgba(239, 68, 68, ${(asset.eligibleToSellHouse || asset.eligibleToSellHotel) ? '0.35' : '0.06'})`,
                        color: (asset.eligibleToSellHouse || asset.eligibleToSellHotel) ? '#f87171' : 'rgba(156, 163, 175, 0.25)',
                        fontFamily: "'DM Sans', sans-serif",
                        transition: 'all 0.2s',
                      }}
                    >
                      Sell {asset.hotel ? 'Hotel' : 'House'} (+₹{fmt(asset.houseVal)})
                      {!(asset.eligibleToSellHouse || asset.eligibleToSellHotel) && (
                        <span style={{ display: 'block', fontSize: 7, color: '#ef4444', fontWeight: 'normal' }}>
                          Violates even-demolish
                        </span>
                      )}
                    </button>
                  )}

                  {/* Mortgage Action */}
                  {!asset.mortgaged && (
                    <button
                      onClick={() => onMortgage(asset.id)}
                      disabled={!asset.eligibleToMortgage}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 'bold',
                        cursor: asset.eligibleToMortgage ? 'pointer' : 'not-allowed',
                        background: asset.eligibleToMortgage ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.02)',
                        border: `1.5px solid rgba(245, 158, 11, ${asset.eligibleToMortgage ? '0.35' : '0.06'})`,
                        color: asset.eligibleToMortgage ? '#fbbf24' : 'rgba(156, 163, 175, 0.25)',
                        fontFamily: "'DM Sans', sans-serif",
                        transition: 'all 0.2s',
                      }}
                    >
                      🏦 Mortgage (+₹{fmt(asset.mortgageVal)})
                      {asset.hasGroupBuildings && asset.houses === 0 && !asset.hotel && (
                        <span style={{ display: 'block', fontSize: 7, color: '#ef4444', fontWeight: 'normal' }}>
                          Sell houses in group first
                        </span>
                      )}
                    </button>
                  )}

                  {/* Unmortgage Action (Only if mortgaged) */}
                  {asset.mortgaged && (
                    <button
                      onClick={() => onUnmortgage(asset.id)}
                      disabled={true} // Disabled since shortfall means they are in debt and cannot afford unmortgaging
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 'bold',
                        cursor: 'not-allowed',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1.5px solid rgba(255,255,255,0.06)',
                        color: 'rgba(156, 163, 175, 0.25)',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      🚫 Mortgaged
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Quick Action Footer */}
      <div style={{
        paddingTop: 8,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flexShrink: 0,
      }}>
        {/* Take Loan if available */}
        {!me.loanActive && (
          <button
            onClick={() => onTakeLoan(2000)} // Default to ₹2,000 borrow
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #d4af37 0%, #aa771c 100%)',
              color: '#000000',
              fontWeight: 900,
              fontSize: 11,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(212,175,55,0.2)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            🏦 Quick Borrow ₹2,000
          </button>
        )}

        {/* Bankruptcy Trigger */}
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to declare bankruptcy? You will be eliminated from the game.')) {
              onDeclareBankruptcy();
            }
          }}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 11,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(239,68,68,0.2)',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          💀 Declare Bankruptcy
        </button>
      </div>
    </div>
  );
}

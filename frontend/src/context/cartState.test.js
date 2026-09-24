import assert from 'node:assert/strict'
import test from 'node:test'

import { createEmptyCartSnapshot, getCartItemCount } from './cartState.js'

test('cart count includes games and DLC', () => {
  assert.equal(getCartItemCount({ items: [{ id: 1 }], dlc_items: [{ id: 2 }, { id: 3 }] }), 3)
})

test('empty cart snapshot clears every purchasable item type', () => {
  const original = {
    id: 7,
    items: [{ id: 1 }],
    dlc_items: [{ id: 2 }],
    total: '29.98',
  }

  assert.deepEqual(createEmptyCartSnapshot(original), {
    id: 7,
    items: [],
    dlc_items: [],
    total: '0.00',
  })
  assert.equal(original.items.length, 1)
  assert.equal(original.dlc_items.length, 1)
})

import { expect, it } from 'vitest'
import { duration, hearts, wheels } from './format'

it('formats fractions and durations', () => {
  expect([hearts(13), hearts(1), hearts(0), hearts(8)]).toEqual(['3¼', '¼', '0', '2'])
  expect([wheels(8), wheels(3), wheels(15)]).toEqual(['1⅗', '⅗', '3'])
  expect([duration(750), duration(65), duration(1800)]).toEqual(['12:30', '1:05', '30:00'])
})

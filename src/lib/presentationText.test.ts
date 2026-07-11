import { describe, expect, it } from 'vitest'
import { normalizePresentationText } from './presentationText'

describe('normalizePresentationText', () => {
  it('corrects known upstream spelling variants without changing unrelated text', () => {
    expect(normalizePresentationText('Exports to Germeny')).toBe('Exports to Germany')
    expect(normalizePresentationText('Northern Province')).toBe('Northern Province')
  })

  it('corrects source typos in metric labels used by tables and selectors', () => {
    expect(normalizePresentationText('Grevious Hurt')).toBe('Grievous Hurt')
    expect(normalizePresentationText('Unnatural Offence/Grve Sexual Abuse')).toBe(
      'Unnatural Offence/Grave Sexual Abuse',
    )
  })
})

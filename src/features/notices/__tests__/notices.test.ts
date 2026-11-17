import { describe, expect, it } from 'vitest';
import { emptyNotice, readShare, sortRecipients, toCreate, validateNotice, waiting } from '../model/notices';

describe('notices', () => {
  it('needs a Bangla title and message and at least one group', () => {
    expect(validateNotice(emptyNotice())).toEqual({ titleBn: 'errors.required', bodyBn: 'errors.required' });
    const v = { ...emptyNotice(), titleBn: 'জরুরি', bodyBn: 'আজ ৪টায় অফিসে আসুন', roles: [] };
    expect(validateNotice(v)).toEqual({ roles: 'errors.roles' });
    expect(validateNotice({ ...v, roles: ['field_staff'], bodyEn: 'x'.repeat(2001) })).toEqual({ bodyEn: 'errors.tooLong' });
  });

  it('sends trimmed text, the picked groups, and branches only when picked', () => {
    const v = { ...emptyNotice('b1'), titleBn: ' জরুরি ', bodyBn: ' আসুন ', requireAck: true };
    expect(toCreate(v)).toEqual({ title: { bn: 'জরুরি', en: '' }, body: { bn: 'আসুন', en: '' }, branchIds: ['b1'], roles: ['field_staff'], requireAck: true });
    expect(toCreate({ ...v, branchIds: [] })).not.toHaveProperty('branchIds');
  });

  it('works out the read share and who is still waiting', () => {
    expect(readShare({ recipientCount: 20, ackCount: 5 })).toBe(0.25);
    expect(readShare({ recipientCount: 0, ackCount: 0 })).toBe(0);
    expect(waiting({ requireAck: true, recipientCount: 20, ackCount: 5 })).toBe(15);
    expect(waiting({ requireAck: false, recipientCount: 20, ackCount: 5 })).toBe(0);
  });

  it('lists people who have not read first, then by name', () => {
    const items = [
      { userId: '1', name: { bn: 'করিম', en: 'Karim' }, acked: true },
      { userId: '2', name: { bn: 'আলম', en: 'Alam' }, acked: false },
      { userId: '3', name: { bn: 'জাহিদ', en: 'Zahid' }, acked: false },
    ];
    expect(sortRecipients(items, 'en').map((x) => x.userId)).toEqual(['2', '3', '1']);
  });
});

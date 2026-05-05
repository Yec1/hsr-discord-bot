
import { QuickDB } from 'quick.db';
const db = new QuickDB();
const userId = '401904370075303978';
async function main() {
  const acct = await db.get(userId + '.account');
  const hoyolabs = await db.get(userId + '.hoyolabs');
  const cookieExpired = await db.get(userId + '.cookieExpired');
  const needsManualUpdate = await db.get(userId + '.needsCookieUpdate');
  const autoRedeemData = await db.get('autoRedeem') as any;
  console.log('account:', JSON.stringify(acct));
  console.log('hoyolabs count:', Array.isArray(hoyolabs) ? (hoyolabs as any[]).length : hoyolabs);
  console.log('cookieExpired:', cookieExpired);
  console.log('needsCookieUpdate:', needsManualUpdate);
  console.log('autoRedeem entry:', JSON.stringify(autoRedeemData?.[userId]));
}
main().catch(console.error);

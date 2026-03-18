const intervalMs = Number(process.env.WORKER_HEARTBEAT_MS ?? 60000);

console.log('CouponBazaar worker started. Reserved for future async jobs.');

setInterval(() => {
  console.log('CouponBazaar worker heartbeat');
}, intervalMs);

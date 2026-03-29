const intervalMs = Number(process.env.WORKER_HEARTBEAT_MS ?? 60000);

console.log('Vouchrex worker started. Reserved for future async jobs.');

setInterval(() => {
  console.log('Vouchrex worker heartbeat');
}, intervalMs);

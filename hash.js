import bcrypt from 'bcryptjs';

async function run() {
  const password = '1224';
  const hash = await bcrypt.hash(password, 10);
  console.log('Hashed password:', hash);
}

run();

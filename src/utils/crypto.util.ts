import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-ctr';
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'una-clave-super-secreta-de-32-caracteres';
const IV = scryptSync(SECRET_KEY, 'salt', 16); // Vector de inicialización estático (o puedes guardarlo en la DB)

export const encrypt = (text: string): string => {
  const cipher = createCipheriv(ALGORITHM, scryptSync(SECRET_KEY, 'salt', 32), IV);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return encrypted.toString('hex');
};

export const decrypt = (hash: string): string => {
  const decipher = createDecipheriv(ALGORITHM, scryptSync(SECRET_KEY, 'salt', 32), IV);
  const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash, 'hex')), decipher.final()]);
  return decrpyted.toString();
};
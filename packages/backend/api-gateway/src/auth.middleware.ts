import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    const auth = request.headers['authorization'] || request.headers['Authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Unauthorized', message: 'Missing Authorization header' });
      return;
    }

    const token = auth.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET as string);

    // Attach decoded token to request for downstream services
    (request as any).user = decoded;
    return;
  } catch (err) {
    request.log?.warn({ err }, 'JWT verification failed');
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    return;
  }
}

export default authGuard;

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export class JwtService {
  static signToken(userId: string, username: string) {
    const payload = {
      sub: userId,
      username,
    };

    const token = jwt.sign(payload, JWT_SECRET as string, {
      expiresIn: '15m',
    });

    return token;
  }

  static verifyToken(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET as string);
    } catch (err) {
      throw err;
    }
  }
}

export default JwtService;

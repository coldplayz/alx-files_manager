// Authentication controller
import buffer from 'buffer';
import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import { v4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

// const uuid = require('uuid');

// console.log('#####', Object.entries(uuid)); // SCAFF
class AuthController {
  /**
   * Parse Authorization header and return a 24-hour token for a valid user.
   */
  static async getConnect(req, res) {
    // get and parse the Basic Authorization header
    const authHeader = req.get('Authorization');
    if (!authHeader) {
      // no authorization value
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const base64Value = authHeader.split(' ')[1];
    // console.log('#######', base64Value, Object.entries(Buffer)); // SCAFF

    // decode the base64 value to ascii
    const asciiValue = buffer.Buffer.from(base64Value, 'base64'/* encoding of first arg */).toString('ascii'/* default */);
    const [email, password] = asciiValue.split(':');

    // find user with matching credentials, if any
    const sha1Pwd = sha1(password);
    const filterObj = { email, password: sha1Pwd };
    const user = await dbClient.findUser(filterObj);

    if (user == null) {
      // no user found
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // console.log('#####', Object.entries(uuid)); // SCAFF
    // user found; create a session for them
    const token = v4();
    const key = `auth_${token}`;

    // store user ID for 24 hours in Redis
    await redisClient.set(key, user._id.toString(), 86400);

    res.json({ token });
  }

  /**
   * sign out a user based on X-Token header value
   */
  static async getDisconnect(req, res) {
    const token = req.get('X-Token');
    if (!token) {
      // no token
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // retrieve the user ID from Redis with token
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId == null) {
      // no user token found in Redis
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // user found in Redis; delete its token
    await redisClient.del(key);
    res.status(204).end();
  }

  /**
   * return a user object with valid token
   */
  static async getMe(req, res) {
    const token = req.get('X-Token');
    if (!token) {
      // no token
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // retrieve the user ID from Redis with token
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId == null) {
      // no user token found in Redis
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // retrieve the user document object from MongoDB
    const objID = ObjectId(userId);
    const user = await dbClient.findUser({ _id: objID });
    if (user == null) {
      // no user token found in Redis
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ id: userId, email: user.email });
  }
}

export default AuthController;

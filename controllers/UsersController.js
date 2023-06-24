import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email } = req.body;
    const pwd = req.body.password;

    // validate credentials
    if (email === undefined) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }

    if (pwd === undefined) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }

    // credentials validated; process request
    const reply = await dbClient.createUser(email, pwd);
    if (reply.id === null) {
      // email exists already
      res.status(400).json({ error: 'Already exist' });
    } else {
      res.status(201).json(reply);
    }
  }
}

export default UsersController;

import { createClient } from 'redis';
import util from 'util';

// Redis
class RedisClient {
  constructor() {
    // this.isConnected = false;
    const client = createClient();

    /*
    // hack to ensure connection before moving on
    while (client.connected === false) {
      //
    }
    */

    client.on('error', (err) => {
      // this.isConnected = false;
      console.log(`${err}`);
    });

    client.on('connect', () => {
      // console.log('In connect'); // SCAFF
      // this.isConnected = true;
      // console.log('this.isConnected =', this.isConnected); // SCAFF
      console.log('connected to redis...');
    });

    /* - algorithm to get updated client connection status.
    const waitConnection = (context) => {
      return new Promise((resolve, reject) => {
        let i = 0;
        const repeatFct = async () => {
          await setTimeout(() => {
            i += 1;
            if (i >= 10) {
              reject();
            } else if (!client.connected) {
              repeatFct();
            } else {
              context.isConnected = true;
              resolve();
            }
          }, 1000);
        };
        repeatFct();
      });
    };

    const ctx = this;

    (async () => {
      await waitConnection(ctx);
    })();
    */

    this.client = client;
    this.rGet = util.promisify(client.get);
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    const val = await this.rGet.call(this.client, key);
    return val;
  }

  async set(key, val, expiration/* seconds */) {
    this.client.set(key, val, (/* err, reply */) => {
      this.client.expire(key, expiration);
    });
  }

  async del(key) {
    this.client.del(key);
  }
}

const redisClient = new RedisClient();
// redisClient.isAlive();
export default redisClient;

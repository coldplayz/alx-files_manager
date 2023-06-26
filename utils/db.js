import { MongoClient } from 'mongodb'; // ES6 module syntax
import sha1 from 'sha1';

// MongoDB
class DBClient {
  constructor() {
    const host = process.env.DB_HOST ? process.env.DB_HOST : '127.0.0.1';
    const port = process.env.DB_PORT ? process.env.DB_PORT : '27017';
    this.db = process.env.DB_DATABASE ? process.env.DB_DATABASE : 'files_manager';

    const url = `mongodb://${host}:${port}/`;

    this.client = new MongoClient(url);

    this.connection = this.client.connect(); // a Promise

    console.log('connected to mongodb...');
  }

  isAlive() {
    return this.client.isConnected();
  }

  /**
   * nbUsers - returns the number of documents in the users collection.
   * returns: a Promise of the result.
   */
  async nbUsers() {
    const client = await this.connection;

    const db = client.db(this.db); // get database
    const coll = db.collection('users'); // get collection
    return coll.find({}).count();
  }

  async nbFiles() {
    const client = await this.connection;

    const db = client.db(this.db);
    const coll = db.collection('files');
    return coll.find({}).count();
  }

  /**
   * createUser - creates a new user in the users collection.
   * @email [string]: the email string
   * @password [string]: the unhashed password
   */
  async createUser(email, password) {
    // NOTE: basic email and password validation to be
    // ...done before invoking this method; i.e. they must be strings, not undefined
    const client = await this.connection;

    // get collection
    const coll = client.db(this.db).collection('users');

    // ensure email and password are unique
    const docs = await coll.find({ email }).count();
    if (docs !== 0) {
      // email already exists; return null id for error
      return { id: null };
    }
    // else create this user record
    const sha1Pwd = sha1(password); // hash the password
    const reply = await coll.insert({ email, password: sha1Pwd });
    const insertedId = reply.insertedIds['0'];

    // return email and new ID
    return { id: insertedId, email };
  }

  /**
   * createFile - creates a new doc in the files collection.
   * @fileDoc: new document to create.
   */
  async createFile(fileDoc) {
    const client = await this.connection;

    const coll = client.db(this.db).collection('files');

    const reply = await coll.insert(fileDoc);
    const insertedId = reply.insertedIds['0'];

    return { id: insertedId };
  }

  /**
   * return the [first] user document matching the query criteria.
   */
  async findUser(filterObj) {
    const client = await this.connection;

    const coll = client.db(this.db).collection('users');

    return coll.findOne(filterObj); // doc object or null
  }

  async findFile(filterObj) {
    const client = await this.connection;

    const coll = client.db(this.db).collection('files');

    return coll.findOne(filterObj); // doc object or null
  }

  /**
   * getPaginatedFiles - returns @size files max for @pageNumber, using @filterObj
   * Args: size/limit, pageNumber, filterObj
   * @size: max number of items per page.
   * @pageNumber {Integer}: the page to return. 0-based.
   */
  async getPaginatedFiles(size, pageNumber, filterObj) {
    const client = await this.connection;

    const coll = client.db(this.db).collection('files');

    // console.log(size, pageNumber, filterObj); // SCAFF

    // calculate skip number
    const skips = size * pageNumber;

    const filterObjCopy = { ...filterObj };

    if (pageNumber === -1) {
      // no pagination
      if (filterObjCopy.parentId === '0') {
        // return all documents [in root, recursively]
        delete filterObjCopy.parentId;
        return coll.aggregate(
          { $match: filterObjCopy },
          null, // callback arg; needed to use prior args as pipeline
        ).toArray();
      }
      // else parentId provided; return all matching documents
      return coll.aggregate(
        { $match: filterObj },
        null, // callback arg; needed to use prior args as pipeline
      ).toArray();
    }

    if (pageNumber !== -1) {
      // pagination
      if (filterObjCopy.parentId === '0') {
        // return all documents [in root] paginated
        delete filterObjCopy.parentId;
        return coll.aggregate(
          { $match: filterObjCopy },
          { $sort: { _id: 1 } }, // ascending order
          { $skip: skips },
          { $limit: size },
          null, // callback arg; needed to use prior args as pipeline
        ).toArray();
      }
    }

    // pageNumber provided, and non-root parentId also; paginate
    return coll.aggregate(
      { $match: filterObj },
      { $sort: { _id: 1 } }, // ascending order
      { $skip: skips },
      { $limit: size },
      null, // callback arg; needed to use prior args as pipeline
    ).toArray();
  }

  /**
   * formatFileDoc - renames the _id field of @doc to id.
   * @doc: the file document to format for sending.
   */
  formatDoc(doc) {
    this.formatDocCalls = this.formatDocCalls ? this.formatDocCalls + 1 : 1;
    const fileDoc = { id: doc._id, ...doc };
    delete fileDoc._id;
    return fileDoc;
  }

  /**
   * updateFile - updates a file document.
   * Args: filterObj, updateDoc
   * @filterObj: the filter criteria
   * @updateDoc: the document with update data to save
   */
  async updateFile(filterObj, updateDoc) {
    const client = await this.connection;

    const coll = client.db(this.db).collection('files');

    // if updateDoc is not using update operators (e.g. $set)
    // ...the entire document matching the _id will be
    // ...replaced by updateDoc.
    await coll.update(filterObj, updateDoc);
  }
}

const dbClient = new DBClient();
export default dbClient;

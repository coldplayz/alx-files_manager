import express from 'express';
import router from './routes/index';

const app = express();
app.use(express.json());

app.use('/'/* router mount point */, router);

const port = process.env.PORT ? process.env.PORT : 5000;

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});

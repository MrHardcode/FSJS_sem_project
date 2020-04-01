import express from "express";
import gameFacade from "../facades/gameFacade";
const router = express.Router();
import { ApiError } from "../errors/apiError"

//import * as mongo from "mongodb"
import setup from "../config/setupDB"
import UserFacade from '../facades/userFacadeWithDB';
import IGameUser from "../interfaces/GameUser";

(async function setupDB() {
  const client = await setup()
  gameFacade.setDatabase(client)
})()

router.post('/nearbyplayers', async function (req, res, next) {
  try {
    //Todo call your facade method
    const userName = req.body.userName;
    const password = req.body.password;
    const lon = req.body.lon;
    const lat = req.body.lat;
    const distance = req.body.distance;
    let nearbyPlayers: Array<any> = await gameFacade.nearbyPlayers(userName, password, lon, lat, distance);
    res.send(nearbyPlayers);
  } catch (err) {
    //Passes the error to the middelware (Express) which will handle the exception (send it in the response)
    //Only do this, if you made proper errors and error messages in the facade
    next(err);
  }
})

router.post('/getPostIfReached', async function (req, res, next) {
  try {
    const postID = req.body.postId;
    const lon = req.body.lon;
    const lat = req.body.lat;
    let post = await gameFacade.getPostIfReached(postID, lat, lon);
    res.send(post);
  } catch (err) {
    next(err);
  }
})

router.post('/createNewPost', async function (req, res, next) {
  try {
    const name = req.body.name;
    const taskTxt = req.body.taskTxt;
    const taskSolution = req.body.taskSolution;
    const isURL = req.body.isURL;
    const lon = req.body.lon;
    const lat = req.body.lat;
    const userName = req.body.userName;
    const password = req.body.password;

    if (!name || !taskTxt || !taskSolution || !lat || !lon || (typeof isURL == "undefined")) {
      throw new ApiError("Missing input", 400);
    }

    const loginSuccess = await UserFacade.checkUser(userName, password);
    if (!loginSuccess) throw new ApiError("wrong username or password", 403);
    const user: IGameUser = await UserFacade.getUser(userName);
    if (user.role != "admin") throw new ApiError("You have to be an admin to do that", 403);

    let post = await gameFacade.addPost(name, taskTxt, isURL, taskSolution, lon, lat);
    res.send(post);
  } catch (err) {
    next(err);
  }
})

module.exports = router;
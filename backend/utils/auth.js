/**
 * @author jk
 * @version 1.0.0
 */

import Models from '../models'
import $      from './index'
import yaml   from 'js-yaml'
import fs     from 'fs'
import path   from 'path'


const UserModel       = Models.V1.UserModel;
const filePath        = path.join(__dirname, 'permission.yml');
const result          = $.result;
const permissionCache = {};
let   yml             = {};
const jwt             = require('jsonwebtoken');


try {
  yml = yaml.safeLoad(fs.readFileSync(filePath , 'utf8'));
} catch (e) {
  console.error(e);
}


function _tokenPromise (token) {
  return new Promise ((resolve, reject) => {
    jwt.verify(token, $.config.secret, (err, value) => {
      if (err) {reject(err); return;}
      resolve(value);
    });
  });
}


module.exports.createToken = (json) => {
  const token = jwt.sign(json, $.config.secret, { expiresIn: '180d'});
  return token;
}


module.exports.loadUser = async function (req, res, next) {
  const token  = req.headers.token || req.body.token || null;
  const userid = req.body.userid || req.query.userid || null;
  let user     = {};
  if (!$.isEmpty(token)) {
    user = await UserModel.find({'token': token});
  } else if(!$.isEmpty(user)) {
    user = await UserModel.find({'_id': userid});
  } else {
    result(res, 'load user error');
  }
  req.user = user;
  next();
}

module.exports.authToken = async function (req, res, next) {
  const token = req.headers.token || req.body.token || null;
  if ($.isEmpty(token)) { return result(res, 'token error'); }

  _tokenPromise(token).then(async (decode) => {
    const user = await UserModel.find({'_id': decode.user});
    if (user) req.user = user, next();
    else result(res, 'token error');
  }).catch(e => {
    result(res, 'token error');
  })
}


module.exports.authSession = async function (req, res, next) {

  if ($.isEmpty(req.session.user)) { return result(res, 'session error'); }

  const user = await UserModel.find({ '_id': req.session.user._id });

  if ($.isEmpty(user)) { return result(res, 'session error'); }

  // 判断权限
  const permissionStr = user.permission.toString();
  let actions = {}, url = `${req.baseUrl}${req.route.path}#${req.method}`;

  if ($.isEmpty(permissionCache[permissionStr])) {
    user.permission.forEach(key => {
      if (yml[key]) { actions = Object.assign(actions, yml[key]); }
    })
    permissionCache[permissionStr] = actions;
  } else {
    actions = permissionCache[permissionStr];
  }

  if (actions[url] === 'allow') { next(); return; }

  result(res, `Permission denied. ${url}, your permission is ${user.permission}`);
}

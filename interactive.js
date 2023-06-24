// imports for interactive node mode; CommonJS syntax
const redis = require('redis');
const mongodb = require('mongodb');
const express = require('express');
const sha1 = require('sha1');
const mime = require('mime-types');
const imageThumbnail = require('image-thumbnail');
const bull = require('bull');
const uuid = require('uuid');

const mods = {
  redis,
  mongodb,
  express,
  sha1,
  mime,
  imageThumbnail,
  bull,
  uuid,
};

module.exports = mods;

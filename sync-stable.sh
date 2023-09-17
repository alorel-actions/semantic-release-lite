#!/bin/bash

git fetch origin --progress --prune &&\
  git checkout master &&\
  git pull &&\
  git fetch origin stable:stable --progress --prune &&\
  git checkout stable &&\
  git merge master &&\
  git push && \
  git checkout master;

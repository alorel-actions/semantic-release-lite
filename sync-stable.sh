#!/bin/bash

git fetch origin --progress --prune &&\
  git fetch origin master:master --progress --prune &&\
  git fetch stable:stable --progress --prune &&\
  git checkout stable &&\
  git merge master &&\
  git push && \
  git checkout master;

#!/usr/bin/env ruby1.9
# -*- coding: utf-8 -*-

#
#
#

require 'sinatra'
require 'logger'

set :views, './views'
set :public, './public'

get '/' do
  puts settings.views
  @canvas_width = 1024;
  @canvas_height = 768;
  erb :index
end

get '/pictures' do
  @files = Dir.glob( 'public/pictures/orig/*.png' ).sort
  erb :pictures
end


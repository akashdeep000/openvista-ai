-- osm-filter.lua

local tables = {}

tables.main = osm2pgsql.define_node_table('features', {
  { column = 'tags', type = 'hstore' },
  { column = 'geom', type = 'point' }
})

function osm2pgsql.process_node(object)
  if object.tags.highway or object.tags.amenity or object.tags.place then
    tables.main:insert({
      tags = object.tags,
      geom = object:as_point()
    })
  end
end

tables.ways = osm2pgsql.define_way_table('ways', {
  { column = 'tags', type = 'hstore' },
  { column = 'geom', type = 'linestring' }
})

function osm2pgsql.process_way(object)
  if object.tags.highway or object.tags.amenity or object.tags.place then
    tables.ways:insert({
      tags = object.tags,
      geom = object:as_linestring()
    })
  end
end

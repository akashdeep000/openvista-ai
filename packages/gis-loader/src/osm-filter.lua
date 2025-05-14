-- Define tables for each OSM element type with appropriate geometries and tag storage
local tables = {}

-- Table for nodes (e.g., amenities, places)
tables.nodes = osm2pgsql.define_node_table('nodes', {
    { column = 'tags', type = 'hstore' },
    { column = 'geom', type = 'point' }
})

-- Table for ways (e.g., roads, paths, linear amenities)
tables.ways = osm2pgsql.define_way_table('ways', {
    { column = 'tags', type = 'hstore' },
    { column = 'geom', type = 'linestring' }
})

-- Table for relations (e.g., routes, boundaries)
tables.relations = osm2pgsql.define_relation_table('relations', {
    { column = 'tags', type = 'hstore' },
    { column = 'geom', type = 'multilinestring' }
})

-- Utility function to check if an object has relevant tags
local function has_relevant_tags(tags)
    return tags and (tags.highway or tags.amenity or tags.place)
end

-- Process nodes (points)
function osm2pgsql.process_node(object)
    if has_relevant_tags(object.tags) then
        tables.nodes:insert({
            tags = object.tags,
            geom = object:as_point()
        })
    end
end

-- Process ways (linestrings)
function osm2pgsql.process_way(object)
    if has_relevant_tags(object.tags) then
        local geom = object:as_linestring()
        if geom then
            tables.ways:insert({
                tags = object.tags,
                geom = geom
            })
        end
    end
end

-- Process relations (multilinestrings, like routes or boundaries)
function osm2pgsql.process_relation(object)
    if has_relevant_tags(object.tags) then
        local geom = object:as_multilinestring()
        if geom then
            tables.relations:insert({
                tags = object.tags,
                geom = geom
            })
        end
    end
end

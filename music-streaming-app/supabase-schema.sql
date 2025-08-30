-- Supabase Database Schema for Music Streaming App
-- Run these SQL commands in your Supabase SQL editor

-- Create tracks table
CREATE TABLE tracks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    album VARCHAR(255),
    duration INTEGER NOT NULL, -- duration in seconds
    audio_url TEXT NOT NULL, -- URL to audio file in Supabase Storage
    image_url TEXT, -- URL to album/cover image
    genre VARCHAR(100),
    release_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create playlists table
CREATE TABLE playlists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    created_by VARCHAR(255),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create playlist_tracks junction table
CREATE TABLE playlist_tracks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(playlist_id, track_id)
);

-- Create user_favorites table (for liked songs)
CREATE TABLE user_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID, -- Will be connected to auth.users later
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, track_id)
);

-- Create indexes for better performance
CREATE INDEX idx_tracks_artist ON tracks(artist);
CREATE INDEX idx_tracks_title ON tracks(title);
CREATE INDEX idx_tracks_created_at ON tracks(created_at);
CREATE INDEX idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX idx_playlist_tracks_position ON playlist_tracks(position);
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access to tracks and playlists
CREATE POLICY "Public tracks are viewable by everyone" ON tracks
    FOR SELECT USING (true);

CREATE POLICY "Public playlists are viewable by everyone" ON playlists
    FOR SELECT USING (is_public = true);

CREATE POLICY "Playlist tracks are viewable by everyone" ON playlist_tracks
    FOR SELECT USING (true);

-- Insert sample data
INSERT INTO tracks (title, artist, album, duration, audio_url, image_url, genre) VALUES
('Baby Shark', 'Pinkfong', 'Kids Songs', 106, 'baby-shark.mp3', '/baby shark.jpeg', 'Kids'),
('Despacito', 'Luis Fonsi ft. Daddy Yankee', 'Vida', 229, 'despacito.mp3', '/Despacito.jpeg', 'Latin Pop'),
('Wheels On The Bus', 'Various Artists', 'Nursery Rhymes', 90, 'wheels-on-the-bus.mp3', '/Wheels On The Bus.jpeg', 'Kids'),
('Johny Johny Yes Papa', 'LooLoo Kids', 'Nursery Rhymes', 75, 'johny-johny-yes-papa.mp3', '/Johny Johny Yes Papa.jpeg', 'Kids'),
('Bath Song', 'Cocomelon', 'Kids Songs', 120, 'bath-song.mp3', '/Bath Song.jpeg', 'Kids'),
('See You Again', 'Wiz Khalifa ft. Charlie Puth', 'Furious 7 Soundtrack', 229, 'see-you-again.mp3', '/See You Again.avif', 'Hip Hop'),
('Shape Of You', 'Ed Sheeran', 'Divide', 233, 'shape-of-you.mp3', '/Shape Of You.avif', 'Pop'),
('Phonics Songs With Two Words', 'Super Simple Songs', 'Educational', 180, 'phonics-songs.mp3', '/Phonics Songs With Two Words.jpeg', 'Educational'),
('Uptown Funk', 'Mark Ronson ft. Bruno Mars', 'Uptown Special', 270, 'uptown-funk.mp3', '/Uptown Funk.jpeg', 'Funk'),
('Gangnam Style', 'PSY', 'PSY 6 (Six Rules), Part 1', 219, 'gangnam-style.mp3', '/Gangnam Style.avif', 'K-Pop');

-- Create a sample playlist
INSERT INTO playlists (name, description, image_url, created_by, is_public) VALUES
('Top Hits', 'Most popular songs', '/top-hits.jpg', 'Spotify', true),
('Kids Favorites', 'Best songs for children', '/kids-favorites.jpg', 'Spotify', true);

-- Add tracks to playlists
INSERT INTO playlist_tracks (playlist_id, track_id, position) 
SELECT 
    p.id,
    t.id,
    ROW_NUMBER() OVER (ORDER BY t.title)
FROM playlists p, tracks t 
WHERE p.name = 'Top Hits' AND t.title IN ('Despacito', 'See You Again', 'Shape Of You', 'Uptown Funk', 'Gangnam Style');

INSERT INTO playlist_tracks (playlist_id, track_id, position) 
SELECT 
    p.id,
    t.id,
    ROW_NUMBER() OVER (ORDER BY t.title)
FROM playlists p, tracks t 
WHERE p.name = 'Kids Favorites' AND t.title IN ('Baby Shark', 'Wheels On The Bus', 'Johny Johny Yes Papa', 'Bath Song', 'Phonics Songs With Two Words');
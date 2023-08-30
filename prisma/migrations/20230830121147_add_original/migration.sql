DROP TABLE ErrorRecord;

CREATE TABLE ErrorRecord (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT NOT NULL,
    originalStack TEXT NOT NULL,
    url TEXT NOT NULL,
    at INTEGER NOT NULL,
    ua TEXT
);

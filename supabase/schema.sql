-- Supabase Schema for Travel Tracker Dashboard

-- 1. Users
CREATE TABLE users (
  username TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT
);

-- 2. Config
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 3. Flights
CREATE TABLE flights (
  id SERIAL PRIMARY KEY,
  bookingstatus TEXT DEFAULT 'Booked',
  airline TEXT,
  fromcode TEXT,
  cityfrom TEXT,
  tocode TEXT,
  cityto TEXT,
  departuredate DATE,
  departuretime TIME,
  arrivaldate DATE,
  arrivaltime TIME,
  confirmationcode TEXT,
  duration TEXT,
  managelink TEXT,
  assignedto TEXT,
  amount NUMERIC(12,2),
  currency TEXT,
  bookingdate DATE,
  trip TEXT,
  fxrate NUMERIC(10,4),
  inrequivalent NUMERIC(12,2),
  amounttype TEXT,
  paymentmethod TEXT
);

-- 4. Hotels
CREATE TABLE hotels (
  id SERIAL PRIMARY KEY,
  bookingstatus TEXT DEFAULT 'Booked',
  hotelname TEXT,
  address TEXT,
  city TEXT,
  checkindate DATE,
  checkoutdate DATE,
  confirmationcode TEXT,
  bookinglink TEXT,
  cancellationdeadline TEXT,
  bookedprice NUMERIC(12,2),
  assignedto TEXT,
  currency TEXT,
  bookingdate DATE,
  trip TEXT,
  fxrate NUMERIC(10,4),
  inrequivalent NUMERIC(12,2),
  amounttype TEXT,
  paymentmethod TEXT,
  mapslink TEXT,
  latitude TEXT,
  longitude TEXT,
  phone TEXT,
  numberofrooms TEXT,
  roomassignments TEXT
);

-- 5. Trains
CREATE TABLE trains (
  id SERIAL PRIMARY KEY,
  bookingstatus TEXT DEFAULT 'Booked',
  trainnumber TEXT,
  trainname TEXT,
  fromcode TEXT,
  cityfrom TEXT,
  tocode TEXT,
  cityto TEXT,
  departuredate DATE,
  departuretime TIME,
  arrivaldate DATE,
  arrivaltime TIME,
  pnr TEXT,
  assignedto TEXT,
  amount NUMERIC(12,2),
  currency TEXT,
  bookingdate DATE,
  trip TEXT,
  fxrate NUMERIC(10,4),
  inrequivalent NUMERIC(12,2),
  amounttype TEXT,
  paymentmethod TEXT,
  class TEXT
);

-- 6. Buses
CREATE TABLE buses (
  id SERIAL PRIMARY KEY,
  bookingstatus TEXT DEFAULT 'Booked',
  busoperator TEXT,
  busnumber TEXT,
  from_station TEXT,
  cityfrom TEXT,
  to_station TEXT,
  cityto TEXT,
  departuredate DATE,
  departuretime TIME,
  arrivaldate DATE,
  arrivaltime TIME,
  ticketnumber TEXT,
  assignedto TEXT,
  amount NUMERIC(12,2),
  currency TEXT,
  bookingdate DATE,
  trip TEXT,
  fxrate NUMERIC(10,4),
  inrequivalent NUMERIC(12,2),
  amounttype TEXT,
  paymentmethod TEXT
);

-- 7. Events
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  eventname TEXT,
  startdate DATE,
  enddate DATE,
  location TEXT,
  type TEXT,
  ourrole TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Booked'
);

-- 8. Expenses
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ,
  username TEXT,
  name TEXT,
  trip TEXT,
  category TEXT,
  amount NUMERIC(12,2),
  currency TEXT,
  description TEXT,
  receipturl TEXT,
  fxrate NUMERIC(10,4),
  inrequivalent NUMERIC(12,2),
  paymentmethod TEXT,
  receiptmimetype TEXT,
  cardused TEXT,
  expensedate DATE
);

-- 9. Advances
CREATE TABLE advances (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ,
  username TEXT,
  name TEXT,
  trip TEXT,
  amount NUMERIC(12,2),
  method TEXT,
  givenby TEXT
);

-- 10. Allowances
CREATE TABLE allowances (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ,
  username TEXT,
  name TEXT,
  trip TEXT,
  amount NUMERIC(12,2),
  method TEXT,
  setby TEXT
);

-- 11. Notes & Reminders
CREATE TABLE notes_reminders (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ,
  username TEXT,
  name TEXT,
  type TEXT,
  text TEXT,
  duedate DATE,
  category TEXT,
  status TEXT,
  duetime TIME
);

-- 12. Documents
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  type TEXT,
  category TEXT,
  confirmationcode TEXT,
  passengername TEXT,
  fileurl TEXT,
  uploadedat TIMESTAMPTZ
);

-- 13. Sessions
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  createdat TEXT NOT NULL,
  expiresat TEXT NOT NULL,
  lastactive TEXT NOT NULL
);

-- Configure Realtime for tables
alter publication supabase_realtime add table flights;
alter publication supabase_realtime add table hotels;
alter publication supabase_realtime add table trains;
alter publication supabase_realtime add table buses;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table advances;
alter publication supabase_realtime add table allowances;
alter publication supabase_realtime add table notes_reminders;
alter publication supabase_realtime add table documents;

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
  departuredate TEXT,
  departuretime TEXT,
  arrivaldate TEXT,
  arrivaltime TEXT,
  confirmationcode TEXT,
  duration TEXT,
  managelink TEXT,
  assignedto TEXT,
  amount TEXT,
  currency TEXT,
  bookingdate TEXT,
  trip TEXT,
  fxrate TEXT,
  inrequivalent TEXT,
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
  checkindate TEXT,
  checkoutdate TEXT,
  confirmationcode TEXT,
  bookinglink TEXT,
  cancellationdeadline TEXT,
  bookedprice TEXT,
  assignedto TEXT,
  currency TEXT,
  bookingdate TEXT,
  trip TEXT,
  fxrate TEXT,
  inrequivalent TEXT,
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
  departuredate TEXT,
  departuretime TEXT,
  arrivaldate TEXT,
  arrivaltime TEXT,
  pnr TEXT,
  assignedto TEXT,
  amount TEXT,
  currency TEXT,
  bookingdate TEXT,
  trip TEXT,
  fxrate TEXT,
  inrequivalent TEXT,
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
  departuredate TEXT,
  departuretime TEXT,
  arrivaldate TEXT,
  arrivaltime TEXT,
  ticketnumber TEXT,
  assignedto TEXT,
  amount TEXT,
  currency TEXT,
  bookingdate TEXT,
  trip TEXT,
  fxrate TEXT,
  inrequivalent TEXT,
  amounttype TEXT,
  paymentmethod TEXT
);

-- 7. Events
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  eventname TEXT,
  startdate TEXT,
  enddate TEXT,
  location TEXT,
  type TEXT,
  ourrole TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Booked'
);

-- 8. Expenses
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  timestamp TEXT,
  username TEXT,
  name TEXT,
  trip TEXT,
  category TEXT,
  amount TEXT,
  currency TEXT,
  description TEXT,
  receipturl TEXT,
  fxrate TEXT,
  inrequivalent TEXT,
  paymentmethod TEXT,
  receiptmimetype TEXT,
  cardused TEXT,
  expensedate TEXT
);

-- 9. Advances
CREATE TABLE advances (
  id SERIAL PRIMARY KEY,
  timestamp TEXT,
  username TEXT,
  name TEXT,
  trip TEXT,
  amount TEXT,
  method TEXT,
  givenby TEXT
);

-- 10. Allowances
CREATE TABLE allowances (
  id SERIAL PRIMARY KEY,
  timestamp TEXT,
  username TEXT,
  name TEXT,
  trip TEXT,
  amount TEXT,
  method TEXT,
  setby TEXT
);

-- 11. Notes & Reminders
CREATE TABLE notes_reminders (
  id SERIAL PRIMARY KEY,
  timestamp TEXT,
  username TEXT,
  name TEXT,
  type TEXT,
  text TEXT,
  duedate TEXT,
  category TEXT,
  status TEXT,
  duetime TEXT
);

-- 12. Documents
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  type TEXT,
  category TEXT,
  confirmationcode TEXT,
  passengername TEXT,
  fileurl TEXT,
  uploadedat TEXT
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

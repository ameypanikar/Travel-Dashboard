-- Dummy Data Seed for Showcase

-- 1. Users
INSERT INTO users (username, name, password, role, email) VALUES
('johndoe', 'John Doe', 'hashed_password_placeholder', 'user', 'john@example.com'),
('janedoe', 'Jane Doe', 'hashed_password_placeholder', 'admin', 'jane@example.com');

-- 3. Flights
INSERT INTO flights (bookingstatus, airline, fromcode, cityfrom, tocode, cityto, departuredate, departuretime, arrivaldate, arrivaltime, confirmationcode, amount, currency, trip) VALUES
('Booked', 'IndiGo', 'DEL', 'New Delhi', 'BOM', 'Mumbai', '2023-12-01', '10:00', '2023-12-01', '12:00', 'XYZ123', '5000', 'INR', 'Mumbai Business Trip');

-- 4. Hotels
INSERT INTO hotels (bookingstatus, hotelname, address, city, checkindate, checkoutdate, confirmationcode, bookedprice, currency, trip) VALUES
('Booked', 'Taj Mahal Palace', 'Apollo Bunder', 'Mumbai', '2023-12-01', '2023-12-05', 'H-XYZ123', '20000', 'INR', 'Mumbai Business Trip');

-- 8. Expenses
INSERT INTO expenses (timestamp, username, name, trip, category, amount, currency, description, expensedate) VALUES
('2023-12-02T10:00:00Z', 'johndoe', 'John Doe', 'Mumbai Business Trip', 'Meals', '1500', 'INR', 'Dinner with client', '2023-12-01');

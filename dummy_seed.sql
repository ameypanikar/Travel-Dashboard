
-- 1. Create a System Manager
DELETE FROM public.users WHERE username IN ('janedoe', 'johndoe');

INSERT INTO public.users (username, name, password, role, email) VALUES
('janedoe', 'Jane Doe', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'System Manager', 'jane@example.com'),
('johndoe', 'John Doe', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'Employee', 'john@example.com');

-- 2. Clear all tables
TRUNCATE TABLE public.flights, public.hotels, public.events, public.trains, public.buses, public.expenses, public.documents, public.notes_reminders, public.advances, public.allowances RESTART IDENTITY CASCADE;

-- 3. Events (Trips)
INSERT INTO public.events (eventname, startdate, enddate, location, description, status) VALUES
('Annual Summit 2024', CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days', 'Bangalore, India', 'Company annual meet and greet', 'Approved'),
('Dubai Expo 2023', '2023-11-10', '2023-11-15', 'Dubai, UAE', 'Global Tech Expo', 'Completed'),
('Tokyo Expansion', CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '21 days', 'Tokyo, Japan', 'Setting up new branch', 'Pending');

-- 4. Flights
INSERT INTO public.flights (trip, airline, fromcode, cityfrom, tocode, cityto, departuredate, departuretime, arrivaldate, arrivaltime, bookingstatus, confirmationcode, duration, assignedto, amount, currency, bookingdate) VALUES
('Annual Summit 2024', 'Vistara UK 902', 'DEL', 'Delhi', 'BLR', 'Bangalore', CURRENT_DATE, '08:00', CURRENT_DATE, '10:30', 'Booked', 'VUK902', '02:30', 'Jane Doe', '12500', 'INR', CURRENT_DATE - INTERVAL '10 days'),
('Dubai Expo 2023', 'Emirates EK 501', 'BOM', 'Mumbai', 'DXB', 'Dubai', '2023-11-10', '04:30', '2023-11-10', '06:15', 'Booked', 'EMDXB23', '03:15', 'Jane Doe', '45000', 'INR', '2023-10-01'),
('Tokyo Expansion', 'ANA NH 830', 'BOM', 'Mumbai', 'NRT', 'Tokyo', CURRENT_DATE + INTERVAL '14 days', '20:00', CURRENT_DATE + INTERVAL '15 days', '07:15', 'Booked', 'ANATK24', '07:45', 'John Doe', '85000', 'INR', CURRENT_DATE - INTERVAL '2 days');

-- 5. Hotels
INSERT INTO public.hotels (trip, hotelname, address, city, checkindate, checkoutdate, bookingstatus, confirmationcode, assignedto, bookedprice, currency) VALUES
('Annual Summit 2024', 'Taj West End', 'Race Course Road', 'Bangalore', CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days', 'Booked', 'TAJBLR', 'Jane Doe', '35000', 'INR'),
('Dubai Expo 2023', 'Burj Al Arab', 'Jumeirah St', 'Dubai', '2023-11-10', '2023-11-15', 'Booked', 'BURJ23', 'Jane Doe', '250000', 'INR'),
('Tokyo Expansion', 'Shinjuku Prince Hotel', 'Kabukicho', 'Tokyo', CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '21 days', 'Booked', 'SHINJ24', 'John Doe', '120000', 'INR');

-- 6. Trains
INSERT INTO public.trains (trip, trainname, trainnumber, fromcode, cityfrom, tocode, cityto, departuredate, departuretime, arrivaldate, arrivaltime, pnr, class, assignedto, amount, currency, bookingstatus) VALUES
('Annual Summit 2024', 'Vande Bharat Exp', '20607', 'SBC', 'Bangalore', 'MYS', 'Mysore', CURRENT_DATE + INTERVAL '1 day', '06:00', CURRENT_DATE + INTERVAL '1 day', '08:00', 'PNR849201', 'CC', 'Jane Doe', '950', 'INR', 'Booked');

-- 7. Buses
INSERT INTO public.buses (trip, busoperator, busnumber, fromstation, cityfrom, tostation, cityto, departuredate, departuretime, arrivaldate, arrivaltime, ticketnumber, assignedto, amount, currency, bookingstatus) VALUES
('Tokyo Expansion', 'Airport Limousine', 'AL-101', 'Narita T1', 'Narita', 'Shinjuku Station', 'Tokyo', CURRENT_DATE + INTERVAL '15 days', '09:00', CURRENT_DATE + INTERVAL '15 days', '10:30', 'TKT-AL101', 'John Doe', '3200', 'JPY', 'Booked');

-- 8. Expenses
INSERT INTO public.expenses (timestamp, username, name, trip, category, amount, currency, description, receipturl, paymentmethod, expensedate) VALUES
(NOW(), 'janedoe', 'Jane Doe', 'Annual Summit 2024', 'Taxi/Transport', '850', 'INR', 'Uber from Airport to Hotel', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'Corporate Card', CURRENT_DATE),
(NOW(), 'janedoe', 'Jane Doe', 'Annual Summit 2024', 'Meals/Dining', '4500', 'INR', 'Client Dinner at XYZ', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'Cash', CURRENT_DATE),
(NOW(), 'janedoe', 'Jane Doe', 'Dubai Expo 2023', 'Visa', '350', 'AED', 'Dubai Visa Fees', NULL, 'Personal Card', '2023-10-15');

-- 9. Notes & Reminders
INSERT INTO public.notes_reminders (timestamp, username, name, type, text, duedate, category, status, duetime) VALUES
(NOW(), 'janedoe', 'Jane Doe', 'reminder', '+NslS9Qx4HQqT/5TSdpZfKghByc/PrDIGwrxiHdBCWoi2fAzW/Npuv+oTSC5fJG5twLisCaQ84IeaA==', CURRENT_DATE + INTERVAL '4 days', 'hKH6gqtwXNqyN/cskGPzoDCH1j1+t+I0AkPeWLINRNlWBkQ=', 'Pending', '17:00'),
(NOW(), 'johndoe', 'John Doe', 'note', 'gS3PmePwIPuI8i1cvYJYhnMCsnCm0/WHBo+98f0xY8PdhauAIoT8orp5uxdqBKH0AzrJVoyI4Rh2XSmCRDo0dmITmA==', NULL, 'ca9LubP+sbYz8j5RBDI+bIB68urrYUWuLf8ePvGbkCGAOqA=', '', '');

-- 10. Documents (Tickets / Confirmations)
INSERT INTO public.documents (type, category, confirmationcode, passengername, fileurl, uploadedat) VALUES
('flight', 'ticket', 'VUK902', 'Jane Doe', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', NOW()),
('flight', 'boardingpass', 'VUK902', 'Jane Doe', 'https://dummyimage.com/600x400/3b82f6/fff.png&text=Vistara+Boarding+Pass', NOW()),
('hotel', 'confirmation', 'TAJBLR', 'Jane Doe', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', NOW()),
('flight', 'ticket', 'ANATK24', 'John Doe', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', NOW());

-- 11. Advances & Allowances
INSERT INTO public.advances (timestamp, username, name, trip, amount, method, givenby) VALUES
(NOW(), 'janedoe', 'Jane Doe', 'Annual Summit 2024', '15000', 'Bank Transfer', 'Finance Dept');

INSERT INTO public.allowances (timestamp, username, name, trip, amount, method, setby) VALUES
(NOW(), 'johndoe', 'John Doe', 'Tokyo Expansion', '500', 'Per Diem (USD)', 'HR Dept');

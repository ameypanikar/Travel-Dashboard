import re

filepath = '/home/embedded4/travel-tracker-dashboard-showcase/supabase/schema.sql'
with open(filepath, 'r') as f:
    sql = f.read()

# Replace dates
sql = re.sub(r'departuredate TEXT', 'departuredate DATE', sql)
sql = re.sub(r'arrivaldate TEXT', 'arrivaldate DATE', sql)
sql = re.sub(r'checkindate TEXT', 'checkindate DATE', sql)
sql = re.sub(r'checkoutdate TEXT', 'checkoutdate DATE', sql)
sql = re.sub(r'bookingdate TEXT', 'bookingdate DATE', sql)
sql = re.sub(r'expensedate TEXT', 'expensedate DATE', sql)
sql = re.sub(r'startdate TEXT', 'startdate DATE', sql)
sql = re.sub(r'enddate TEXT', 'enddate DATE', sql)
sql = re.sub(r'duedate TEXT', 'duedate DATE', sql)
sql = re.sub(r'uploadedat TEXT', 'uploadedat TIMESTAMPTZ', sql)
sql = re.sub(r'timestamp TEXT', 'timestamp TIMESTAMPTZ', sql)

# Replace times
sql = re.sub(r'departuretime TEXT', 'departuretime TIME', sql)
sql = re.sub(r'arrivaltime TEXT', 'arrivaltime TIME', sql)
sql = re.sub(r'duetime TEXT', 'duetime TIME', sql)

# Replace numeric values
sql = re.sub(r'amount TEXT', 'amount NUMERIC(12,2)', sql)
sql = re.sub(r'bookedprice TEXT', 'bookedprice NUMERIC(12,2)', sql)
sql = re.sub(r'fxrate TEXT', 'fxrate NUMERIC(10,4)', sql)
sql = re.sub(r'inrequivalent TEXT', 'inrequivalent NUMERIC(12,2)', sql)

with open(filepath, 'w') as f:
    f.write(sql)
    
print("Updated schema.sql successfully.")

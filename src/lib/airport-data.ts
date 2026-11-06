// Curated Global & Regional Airport Coordinates Dataset
// Free, 0ms latency, zero API keys, works offline
// Includes major commercial airports worldwide with IATA, city, country, coordinates

export type AirportInfo = {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  isInternational: boolean;
};

export const GLOBAL_AIRPORTS: AirportInfo[] = [
  // --- INDIA (Major Commercial Hubs) ---
  { iata: "DEL", name: "Indira Gandhi International Airport", city: "New Delhi", country: "India", lat: 28.5562, lon: 77.1000, isInternational: true },
  { iata: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", country: "India", lat: 19.0896, lon: 72.8656, isInternational: true },
  { iata: "BLR", name: "Kempegowda International Airport", city: "Bengaluru", country: "India", lat: 13.1986, lon: 77.7066, isInternational: true },
  { iata: "MAA", name: "Chennai International Airport", city: "Chennai", country: "India", lat: 12.9941, lon: 80.1709, isInternational: true },
  { iata: "HYD", name: "Rajiv Gandhi International Airport", city: "Hyderabad", country: "India", lat: 17.2403, lon: 78.4294, isInternational: true },
  { iata: "CCU", name: "Netaji Subhash Chandra Bose International Airport", city: "Kolkata", country: "India", lat: 22.6547, lon: 88.4467, isInternational: true },
  { iata: "PNQ", name: "Pune Airport", city: "Pune", country: "India", lat: 18.5822, lon: 73.9197, isInternational: true },
  { iata: "AMD", name: "Sardar Vallabhbhai Patel International Airport", city: "Ahmedabad", country: "India", lat: 23.0772, lon: 72.6347, isInternational: true },
  { iata: "GOI", name: "Dabolim Airport", city: "Goa (Dabolim)", country: "India", lat: 15.3808, lon: 73.8314, isInternational: true },
  { iata: "GOX", name: "Manohar International Airport", city: "Goa (Mopa)", country: "India", lat: 15.7667, lon: 73.8667, isInternational: true },
  { iata: "COK", name: "Cochin International Airport", city: "Kochi", country: "India", lat: 10.1520, lon: 76.3922, isInternational: true },
  { iata: "TRV", name: "Thiruvananthapuram International Airport", city: "Thiruvananthapuram", country: "India", lat: 8.4821, lon: 76.9200, isInternational: true },
  { iata: "CCJ", name: "Calicut International Airport", city: "Kozhikode", country: "India", lat: 11.1368, lon: 75.9553, isInternational: true },
  { iata: "JAI", name: "Jaipur International Airport", city: "Jaipur", country: "India", lat: 26.8242, lon: 75.8122, isInternational: true },
  { iata: "LKO", name: "Chaudhary Charan Singh International Airport", city: "Lucknow", country: "India", lat: 26.7606, lon: 80.8893, isInternational: true },
  { iata: "IXC", name: "Shaheed Bhagat Singh International Airport", city: "Chandigarh", country: "India", lat: 30.6735, lon: 76.7885, isInternational: true },
  { iata: "GAU", name: "Lokpriya Gopinath Bordoloi International Airport", city: "Guwahati", country: "India", lat: 26.1061, lon: 91.5859, isInternational: true },
  { iata: "PAT", name: "Jayprakash Narayan Airport", city: "Patna", country: "India", lat: 25.5913, lon: 85.0880, isInternational: false },
  { iata: "BBI", name: "Biju Patnaik Airport", city: "Bhubaneswar", country: "India", lat: 20.2444, lon: 85.8178, isInternational: true },
  { iata: "VNS", name: "Lal Bahadur Shastri Airport", city: "Varanasi", country: "India", lat: 25.4524, lon: 82.8593, isInternational: true },
  { iata: "IXR", name: "Birsa Munda Airport", city: "Ranchi", country: "India", lat: 23.3143, lon: 85.3217, isInternational: false },
  { iata: "RPR", name: "Swami Vivekananda Airport", city: "Raipur", country: "India", lat: 21.1804, lon: 81.7388, isInternational: false },
  { iata: "NAG", name: "Dr. Babasaheb Ambedkar International Airport", city: "Nagpur", country: "India", lat: 21.0922, lon: 79.0472, isInternational: true },
  { iata: "IDR", name: "Devi Ahilya Bai Holkar Airport", city: "Indore", country: "India", lat: 22.7217, lon: 75.8011, isInternational: true },
  { iata: "BHO", name: "Raja Bhoj Airport", city: "Bhopal", country: "India", lat: 23.2875, lon: 77.3378, isInternational: false },
  { iata: "SXR", name: "Sheikh ul-Alam International Airport", city: "Srinagar", country: "India", lat: 33.9871, lon: 74.7742, isInternational: true },
  { iata: "ATQ", name: "Sri Guru Ram Dass Jee International Airport", city: "Amritsar", country: "India", lat: 31.7096, lon: 74.7973, isInternational: true },
  { iata: "IXB", name: "Bagdogra International Airport", city: "Siliguri / Bagdogra", country: "India", lat: 26.6812, lon: 88.3286, isInternational: true },
  { iata: "IXZ", name: "Veer Savarkar International Airport", city: "Port Blair", country: "India", lat: 11.6410, lon: 92.7297, isInternational: true },
  { iata: "IXE", name: "Mangaluru International Airport", city: "Mangaluru", country: "India", lat: 12.9613, lon: 74.8900, isInternational: true },
  { iata: "CJB", name: "Coimbatore International Airport", city: "Coimbatore", country: "India", lat: 11.0300, lon: 77.0434, isInternational: true },
  { iata: "TRZ", name: "Tiruchirappalli International Airport", city: "Tiruchirappalli", country: "India", lat: 10.7654, lon: 78.7097, isInternational: true },
  { iata: "VTZ", name: "Visakhapatnam Airport", city: "Visakhapatnam", country: "India", lat: 17.7212, lon: 83.2245, isInternational: true },
  { iata: "VGA", name: "Vijayawada Airport", city: "Vijayawada", country: "India", lat: 16.5304, lon: 80.7968, isInternational: true },
  { iata: "BDQ", name: "Vadodara Airport", city: "Vadodara", country: "India", lat: 22.3362, lon: 73.2263, isInternational: false },
  { iata: "STV", name: "Surat International Airport", city: "Surat", country: "India", lat: 21.1141, lon: 72.7419, isInternational: true },
  { iata: "UDR", name: "Maharana Pratap Airport", city: "Udaipur", country: "India", lat: 24.6178, lon: 73.8961, isInternational: false },
  { iata: "JDH", name: "Jodhpur Airport", city: "Jodhpur", country: "India", lat: 26.2511, lon: 73.0489, isInternational: false },
  { iata: "DED", name: "Jolly Grant Airport", city: "Dehradun", country: "India", lat: 30.1897, lon: 78.1803, isInternational: false },
  { iata: "HJR", name: "Khajuraho Airport", city: "Khajuraho", country: "India", lat: 24.8172, lon: 79.9197, isInternational: false },

  // --- MIDDLE EAST ---
  { iata: "DXB", name: "Dubai International Airport", city: "Dubai", country: "United Arab Emirates", lat: 25.2532, lon: 55.3657, isInternational: true },
  { iata: "DWC", name: "Al Maktoum International Airport", city: "Dubai (DWC)", country: "United Arab Emirates", lat: 24.8960, lon: 55.1614, isInternational: true },
  { iata: "AUH", name: "Zayed International Airport", city: "Abu Dhabi", country: "United Arab Emirates", lat: 24.4330, lon: 54.6511, isInternational: true },
  { iata: "SHJ", name: "Sharjah International Airport", city: "Sharjah", country: "United Arab Emirates", lat: 25.3286, lon: 55.5172, isInternational: true },
  { iata: "DOH", name: "Hamad International Airport", city: "Doha", country: "Qatar", lat: 25.2731, lon: 51.6081, isInternational: true },
  { iata: "RUH", name: "King Khalid International Airport", city: "Riyadh", country: "Saudi Arabia", lat: 24.9576, lon: 46.6988, isInternational: true },
  { iata: "JED", name: "King Abdulaziz International Airport", city: "Jeddah", country: "Saudi Arabia", lat: 21.6796, lon: 39.1565, isInternational: true },
  { iata: "DMM", name: "King Fahd International Airport", city: "Dammam", country: "Saudi Arabia", lat: 26.4712, lon: 49.7979, isInternational: true },
  { iata: "BAH", name: "Bahrain International Airport", city: "Manama", country: "Bahrain", lat: 26.2708, lon: 50.6336, isInternational: true },
  { iata: "MCT", name: "Muscat International Airport", city: "Muscat", country: "Oman", lat: 23.5933, lon: 58.2844, isInternational: true },
  { iata: "KWI", name: "Kuwait International Airport", city: "Kuwait City", country: "Kuwait", lat: 29.2266, lon: 47.9789, isInternational: true },

  // --- SOUTHEAST & EAST ASIA ---
  { iata: "SIN", name: "Singapore Changi Airport", city: "Singapore", country: "Singapore", lat: 1.3644, lon: 103.9915, isInternational: true },
  { iata: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "Thailand", lat: 13.6900, lon: 100.7501, isInternational: true },
  { iata: "DMK", name: "Don Mueang International Airport", city: "Bangkok (Don Mueang)", country: "Thailand", lat: 13.9126, lon: 100.6067, isInternational: true },
  { iata: "HKT", name: "Phuket International Airport", city: "Phuket", country: "Thailand", lat: 8.1132, lon: 98.3169, isInternational: true },
  { iata: "KUL", name: "Kuala Lumpur International Airport", city: "Kuala Lumpur", country: "Malaysia", lat: 2.7456, lon: 101.7072, isInternational: true },
  { iata: "PEN", name: "Penang International Airport", city: "Penang", country: "Malaysia", lat: 5.2971, lon: 100.2769, isInternational: true },
  { iata: "CGK", name: "Soekarno-Hatta International Airport", city: "Jakarta", country: "Indonesia", lat: -6.1275, lon: 106.6537, isInternational: true },
  { iata: "DPS", name: "Ngurah Rai International Airport", city: "Bali", country: "Indonesia", lat: -8.7482, lon: 115.1672, isInternational: true },
  { iata: "MNL", name: "Ninoy Aquino International Airport", city: "Manila", country: "Philippines", lat: 14.5086, lon: 121.0194, isInternational: true },
  { iata: "SGN", name: "Tan Son Nhat International Airport", city: "Ho Chi Minh City", country: "Vietnam", lat: 10.8188, lon: 106.6519, isInternational: true },
  { iata: "HAN", name: "Noi Bai International Airport", city: "Hanoi", country: "Vietnam", lat: 21.2212, lon: 105.8072, isInternational: true },
  { iata: "HKG", name: "Hong Kong International Airport", city: "Hong Kong", country: "Hong Kong", lat: 22.3080, lon: 113.9185, isInternational: true },
  { iata: "TPE", name: "Taoyuan International Airport", city: "Taipei (Taoyuan)", country: "Taiwan", lat: 25.0797, lon: 121.2342, isInternational: true },
  { iata: "TSA", name: "Taipei Songshan Airport", city: "Taipei (Songshan)", country: "Taiwan", lat: 25.0697, lon: 121.5525, isInternational: true },
  { iata: "HND", name: "Tokyo Haneda Airport", city: "Tokyo (Haneda)", country: "Japan", lat: 35.5494, lon: 139.7798, isInternational: true },
  { iata: "NRT", name: "Narita International Airport", city: "Tokyo (Narita)", country: "Japan", lat: 35.7720, lon: 140.3929, isInternational: true },
  { iata: "KIX", name: "Kansai International Airport", city: "Osaka", country: "Japan", lat: 34.4347, lon: 135.2440, isInternational: true },
  { iata: "ICN", name: "Incheon International Airport", city: "Seoul (Incheon)", country: "South Korea", lat: 37.4602, lon: 126.4407, isInternational: true },
  { iata: "GMP", name: "Gimpo International Airport", city: "Seoul (Gimpo)", country: "South Korea", lat: 37.5583, lon: 126.7906, isInternational: true },
  { iata: "PVG", name: "Shanghai Pudong International Airport", city: "Shanghai (Pudong)", country: "China", lat: 31.1443, lon: 121.8083, isInternational: true },
  { iata: "SHA", name: "Shanghai Hongqiao International Airport", city: "Shanghai (Hongqiao)", country: "China", lat: 31.1979, lon: 121.3363, isInternational: true },
  { iata: "PEK", name: "Beijing Capital International Airport", city: "Beijing (Capital)", country: "China", lat: 40.0799, lon: 116.6031, isInternational: true },
  { iata: "PKX", name: "Beijing Daxing International Airport", city: "Beijing (Daxing)", country: "China", lat: 39.5098, lon: 116.4105, isInternational: true },
  { iata: "CAN", name: "Guangzhou Baiyun International Airport", city: "Guangzhou", country: "China", lat: 23.3959, lon: 113.3080, isInternational: true },
  { iata: "SZX", name: "Shenzhen Bao'an International Airport", city: "Shenzhen", country: "China", lat: 22.6393, lon: 113.8107, isInternational: true },

  // --- EUROPE & UK ---
  { iata: "LHR", name: "London Heathrow Airport", city: "London (Heathrow)", country: "United Kingdom", lat: 51.4700, lon: -0.4543, isInternational: true },
  { iata: "LGW", name: "London Gatwick Airport", city: "London (Gatwick)", country: "United Kingdom", lat: 51.1537, lon: -0.1821, isInternational: true },
  { iata: "STN", name: "London Stansted Airport", city: "London (Stansted)", country: "United Kingdom", lat: 51.8860, lon: 0.2389, isInternational: true },
  { iata: "MAN", name: "Manchester Airport", city: "Manchester", country: "United Kingdom", lat: 53.3537, lon: -2.2750, isInternational: true },
  { iata: "CDG", name: "Paris Charles de Gaulle Airport", city: "Paris (CDG)", country: "France", lat: 49.0097, lon: 2.5479, isInternational: true },
  { iata: "ORY", name: "Paris Orly Airport", city: "Paris (Orly)", country: "France", lat: 48.7262, lon: 2.3652, isInternational: true },
  { iata: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "Germany", lat: 50.0379, lon: 8.5622, isInternational: true },
  { iata: "MUC", name: "Munich Airport", city: "Munich", country: "Germany", lat: 48.3537, lon: 11.7750, isInternational: true },
  { iata: "BER", name: "Berlin Brandenburg Airport", city: "Berlin", country: "Germany", lat: 52.3667, lon: 13.5033, isInternational: true },
  { iata: "DUS", name: "Düsseldorf Airport", city: "Düsseldorf", country: "Germany", lat: 51.2895, lon: 6.7668, isInternational: true },
  { iata: "HAM", name: "Hamburg Airport", city: "Hamburg", country: "Germany", lat: 53.6304, lon: 9.9882, isInternational: true },
  { iata: "AMS", name: "Amsterdam Airport Schiphol", city: "Amsterdam", country: "Netherlands", lat: 52.3105, lon: 4.7683, isInternational: true },
  { iata: "BRU", name: "Brussels Airport", city: "Brussels", country: "Belgium", lat: 50.9010, lon: 4.4844, isInternational: true },
  { iata: "ZRH", name: "Zurich Airport", city: "Zurich", country: "Switzerland", lat: 47.4582, lon: 8.5555, isInternational: true },
  { iata: "GVA", name: "Geneva Airport", city: "Geneva", country: "Switzerland", lat: 46.2381, lon: 6.1089, isInternational: true },
  { iata: "VIE", name: "Vienna International Airport", city: "Vienna", country: "Austria", lat: 48.1103, lon: 16.5697, isInternational: true },
  { iata: "FCO", name: "Rome Fiumicino Airport", city: "Rome (FCO)", country: "Italy", lat: 41.8003, lon: 12.2389, isInternational: true },
  { iata: "MXP", name: "Milan Malpensa Airport", city: "Milan (Malpensa)", country: "Italy", lat: 45.6301, lon: 8.7231, isInternational: true },
  { iata: "LIN", name: "Milan Linate Airport", city: "Milan (Linate)", country: "Italy", lat: 45.4451, lon: 9.2767, isInternational: true },
  { iata: "BCN", name: "Josep Tarradellas Barcelona-El Prat Airport", city: "Barcelona", country: "Spain", lat: 41.2974, lon: 2.0833, isInternational: true },
  { iata: "MAD", name: "Adolfo Suárez Madrid-Barajas Airport", city: "Madrid", country: "Spain", lat: 40.4839, lon: -3.5680, isInternational: true },
  { iata: "LIS", name: "Humberto Delgado Airport", city: "Lisbon", country: "Portugal", lat: 38.7742, lon: -9.1342, isInternational: true },
  { iata: "DUB", name: "Dublin Airport", city: "Dublin", country: "Ireland", lat: 53.4264, lon: -6.2499, isInternational: true },
  { iata: "CPH", name: "Copenhagen Airport", city: "Copenhagen", country: "Denmark", lat: 55.6180, lon: 12.6508, isInternational: true },
  { iata: "ARN", name: "Stockholm Arlanda Airport", city: "Stockholm", country: "Sweden", lat: 59.6498, lon: 17.9238, isInternational: true },
  { iata: "OSL", name: "Oslo Airport Gardermoen", city: "Oslo", country: "Norway", lat: 60.1976, lon: 11.1004, isInternational: true },
  { iata: "HEL", name: "Helsinki-Vantaa Airport", city: "Helsinki", country: "Finland", lat: 60.3172, lon: 24.9633, isInternational: true },
  { iata: "WAW", name: "Warsaw Chopin Airport", city: "Warsaw", country: "Poland", lat: 52.1672, lon: 20.9679, isInternational: true },
  { iata: "PRG", name: "Václav Havel Airport Prague", city: "Prague", country: "Czech Republic", lat: 50.1008, lon: 14.2600, isInternational: true },
  { iata: "BUD", name: "Budapest Ferenc Liszt International Airport", city: "Budapest", country: "Hungary", lat: 47.4369, lon: 19.2556, isInternational: true },
  { iata: "ATH", name: "Athens International Airport", city: "Athens", country: "Greece", lat: 37.9364, lon: 23.9445, isInternational: true },
  { iata: "IST", name: "Istanbul Airport", city: "Istanbul", country: "Turkey", lat: 41.2753, lon: 28.7519, isInternational: true },
  { iata: "SAW", name: "Sabiha Gökçen International Airport", city: "Istanbul (Sabiha)", country: "Turkey", lat: 40.8986, lon: 29.3092, isInternational: true },

  // --- NORTH AMERICA ---
  { iata: "JFK", name: "John F. Kennedy International Airport", city: "New York (JFK)", country: "United States", lat: 40.6413, lon: -73.7781, isInternational: true },
  { iata: "EWR", name: "Newark Liberty International Airport", city: "New York (Newark)", country: "United States", lat: 40.6895, lon: -74.1745, isInternational: true },
  { iata: "LGA", name: "LaGuardia Airport", city: "New York (LaGuardia)", country: "United States", lat: 40.7769, lon: -73.8740, isInternational: false },
  { iata: "BOS", name: "Boston Logan International Airport", city: "Boston", country: "United States", lat: 42.3656, lon: -71.0096, isInternational: true },
  { iata: "IAD", name: "Washington Dulles International Airport", city: "Washington (Dulles)", country: "United States", lat: 38.9531, lon: -77.4565, isInternational: true },
  { iata: "DCA", name: "Ronald Reagan Washington National Airport", city: "Washington (Reagan)", country: "United States", lat: 38.8512, lon: -77.0402, isInternational: false },
  { iata: "ORD", name: "O'Hare International Airport", city: "Chicago (O'Hare)", country: "United States", lat: 41.9742, lon: -87.9073, isInternational: true },
  { iata: "MDW", name: "Chicago Midway International Airport", city: "Chicago (Midway)", country: "United States", lat: 41.7868, lon: -87.7522, isInternational: false },
  { iata: "ATL", name: "Hartsfield-Jackson Atlanta International Airport", city: "Atlanta", country: "United States", lat: 33.6407, lon: -84.4277, isInternational: true },
  { iata: "MIA", name: "Miami International Airport", city: "Miami", country: "United States", lat: 25.7959, lon: -80.2870, isInternational: true },
  { iata: "DFW", name: "Dallas/Fort Worth International Airport", city: "Dallas/Fort Worth", country: "United States", lat: 32.8998, lon: -97.0403, isInternational: true },
  { iata: "IAH", name: "George Bush Intercontinental Airport", city: "Houston", country: "United States", lat: 29.9902, lon: -95.3368, isInternational: true },
  { iata: "DEN", name: "Denver International Airport", city: "Denver", country: "United States", lat: 39.8561, lon: -104.6737, isInternational: true },
  { iata: "PHX", name: "Phoenix Sky Harbor International Airport", city: "Phoenix", country: "United States", lat: 33.4352, lon: -112.0101, isInternational: true },
  { iata: "LAS", name: "Harry Reid International Airport", city: "Las Vegas", country: "United States", lat: 36.0840, lon: -115.1537, isInternational: true },
  { iata: "LAX", name: "Los Angeles International Airport", city: "Los Angeles", country: "United States", lat: 33.9416, lon: -118.4085, isInternational: true },
  { iata: "SFO", name: "San Francisco International Airport", city: "San Francisco", country: "United States", lat: 37.6213, lon: -122.3790, isInternational: true },
  { iata: "SJC", name: "Norman Y. Mineta San Jose International Airport", city: "San Jose (Silicon Valley)", country: "United States", lat: 37.3639, lon: -121.9289, isInternational: true },
  { iata: "OAK", name: "Oakland International Airport", city: "Oakland", country: "United States", lat: 37.7213, lon: -122.2207, isInternational: true },
  { iata: "SEA", name: "Seattle-Tacoma International Airport", city: "Seattle", country: "United States", lat: 47.4502, lon: -122.3088, isInternational: true },
  { iata: "YYZ", name: "Toronto Pearson International Airport", city: "Toronto", country: "Canada", lat: 43.6777, lon: -79.6248, isInternational: true },
  { iata: "YVR", name: "Vancouver International Airport", city: "Vancouver", country: "Canada", lat: 49.1967, lon: -123.1815, isInternational: true },
  { iata: "YUL", name: "Montréal-Trudeau International Airport", city: "Montreal", country: "Canada", lat: 45.4706, lon: -73.7408, isInternational: true },

  // --- OCEANIA ---
  { iata: "SYD", name: "Sydney Kingsford Smith Airport", city: "Sydney", country: "Australia", lat: -33.9399, lon: 151.1753, isInternational: true },
  { iata: "MEL", name: "Melbourne Airport", city: "Melbourne", country: "Australia", lat: -37.6690, lon: 144.8410, isInternational: true },
  { iata: "BNE", name: "Brisbane Airport", city: "Brisbane", country: "Australia", lat: -27.3842, lon: 153.1175, isInternational: true },
  { iata: "PER", name: "Perth Airport", city: "Perth", country: "Australia", lat: -31.9403, lon: 115.9672, isInternational: true },
  { iata: "AKL", name: "Auckland Airport", city: "Auckland", country: "New Zealand", lat: -37.0082, lon: 174.7850, isInternational: true },
];

/**
 * Calculates Haversine distance in kilometers between two geo-coordinates
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export type NearestAirportResult = AirportInfo & {
  distanceKm: number;
  driveTimeEstimate: string;
  flightSearchUrl: string;
};

/**
 * Finds the nearest commercial airports to a given lat/lon point with distance and estimated drive duration
 */
export function findNearestAirports(lat: number, lon: number, limit = 3): NearestAirportResult[] {
  const scored = GLOBAL_AIRPORTS.map((airport) => {
    const distanceKm = haversineDistanceKm(lat, lon, airport.lat, airport.lon);
    
    // Approximate driving time estimate based on realistic city traffic (~35-45 km/h average)
    let driveTimeEstimate = "";
    if (distanceKm <= 5) {
      driveTimeEstimate = "~10-15 mins drive";
    } else if (distanceKm <= 20) {
      driveTimeEstimate = `~${Math.round((distanceKm / 30) * 60)} mins drive`;
    } else if (distanceKm <= 60) {
      const minutes = Math.round((distanceKm / 40) * 60);
      const hours = Math.floor(minutes / 60);
      const rem = minutes % 60;
      driveTimeEstimate = hours > 0 ? `~${hours}h ${rem}m drive` : `~${rem}m drive`;
    } else {
      const hours = Math.floor(distanceKm / 50);
      const rem = Math.round((distanceKm % 50) / 50 * 60);
      driveTimeEstimate = `~${hours}h ${rem}m drive (${distanceKm} km)`;
    }

    const flightSearchUrl = `https://www.google.com/travel/flights?q=flights+to+${airport.iata}`;

    return {
      ...airport,
      distanceKm,
      driveTimeEstimate,
      flightSearchUrl,
    };
  });

  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  return scored.slice(0, limit);
}

/**
 * Fast lookup airport by 3-letter IATA code
 */
export function getAirportByCode(code: string): AirportInfo | null {
  if (!code) return null;
  const clean = code.trim().toUpperCase();
  return GLOBAL_AIRPORTS.find((a) => a.iata === clean) || null;
}


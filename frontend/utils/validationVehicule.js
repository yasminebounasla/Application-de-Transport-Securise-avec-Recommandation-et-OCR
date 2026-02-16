
export const CAR_BRANDS_WITH_MODELS = {
  'Peugeot': ['208', '308', '508', '2008', '3008', '5008', 'Rifter', 'Partner', 'Expert'],
  'Renault': ['Clio', 'Megane', 'Captur', 'Kadjar', 'Scenic', 'Talisman', 'Kangoo', 'Trafic'],
  'Citroën': ['C3', 'C4', 'C5', 'Berlingo', 'Jumpy', 'Spacetourer'],
  'Dacia': ['Sandero', 'Duster', 'Logan', 'Lodgy', 'Dokker'],
  'Toyota': ['Yaris', 'Corolla', 'Camry', 'RAV4', 'Highlander', 'Land Cruiser', 'Prius', 'Hilux'],
  'Honda': ['Civic', 'Accord', 'CR-V', 'HR-V', 'Jazz', 'Pilot'],
  'Nissan': ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Leaf', 'Navara'],
  'Mazda': ['2', '3', '6', 'CX-3', 'CX-5', 'CX-30', 'MX-5'],
  'Suzuki': ['Swift', 'Vitara', 'S-Cross', 'Jimny', 'Ignis'],
  'Mitsubishi': ['Space Star', 'ASX', 'Eclipse Cross', 'Outlander', 'L200'],
  'Hyundai': ['i10', 'i20', 'i30', 'Tucson', 'Kona', 'Santa Fe', 'Ioniq'],
  'Kia': ['Picanto', 'Rio', 'Ceed', 'Sportage', 'Niro', 'Sorento', 'Stonic'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLC', 'GLE', 'GLS', 'Vito', 'Sprinter'],
  'BMW': ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7', 'i3', 'i4', 'iX'],
  'Audi': ['A1', 'A3', 'A4', 'A6', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron'],
  'Volkswagen': ['Polo', 'Golf', 'Passat', 'Tiguan', 'Touareg', 'T-Cross', 'T-Roc', 'ID.3', 'ID.4', 'Transporter'],
  'Opel': ['Corsa', 'Astra', 'Insignia', 'Crossland', 'Grandland', 'Combo', 'Vivaro'],
  'Ford': ['Fiesta', 'Focus', 'Mondeo', 'Puma', 'Kuga', 'Explorer', 'Mustang', 'Ranger', 'Transit'],
  'Chevrolet': ['Spark', 'Cruze', 'Malibu', 'Equinox', 'Traverse', 'Silverado'],
  'Fiat': ['500', 'Panda', 'Tipo', '500X', 'Ducato'],
  'Seat': ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco'],
  'Skoda': ['Fabia', 'Scala', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq'],
  'Volvo': ['V40', 'V60', 'V90', 'S60', 'S90', 'XC40', 'XC60', 'XC90'],
  'Lexus': ['CT', 'IS', 'ES', 'GS', 'LS', 'UX', 'NX', 'RX'],
  'Subaru': ['Impreza', 'XV', 'Forester', 'Outback', 'Legacy'],
  'Isuzu': ['D-Max'],
  'Jeep': ['Renegade', 'Compass', 'Cherokee', 'Grand Cherokee', 'Wrangler', 'Gladiator'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover Evoque', 'Range Rover Sport'],
  'Range Rover': ['Evoque', 'Velar', 'Sport', 'Standard', 'Autobiography'],
  'Porsche': ['718', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
  'Ferrari': ['Roma', 'Portofino', 'F8', 'SF90', '812'],
  'Lamborghini': ['Huracan', 'Aventador', 'Urus'],
  'Bentley': ['Continental', 'Flying Spur', 'Bentayga'],
  'Rolls-Royce': ['Ghost', 'Phantom', 'Wraith', 'Dawn', 'Cullinan'],
  'Aston Martin': ['Vantage', 'DB11', 'DBS', 'DBX'],
  'Jaguar': ['XE', 'XF', 'F-Type', 'E-Pace', 'F-Pace', 'I-Pace'],
  'Mini': ['Cooper', 'Clubman', 'Countryman', 'Convertible'],
  'Alfa Romeo': ['Giulietta', 'Giulia', 'Stelvio', 'Tonale'],
  'Lancia': ['Ypsilon'],
  'Maserati': ['Ghibli', 'Quattroporte', 'Levante', 'MC20'],
  'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y'],
  'BYD': ['Han', 'Tang', 'Song', 'Dolphin', 'Seal'],
  'Geely': ['Coolray', 'Emgrand'],
  'Changan': ['CS35', 'CS55', 'CS75', 'Eado'],
  'MG': ['MG3', 'MG4', 'MG5', 'HS', 'ZS', 'Marvel R'],
  'Great Wall': ['Wingle', 'Poer'],
  'Haval': ['H6', 'Jolion', 'F7'],
  'Chery': ['Tiggo', 'Arrizo'],
  'JAC': ['S3', 'S4', 'T6'],
};

export const VALID_CAR_BRANDS = Object.keys(CAR_BRANDS_WITH_MODELS);

export const VALID_COLORS = [
  'Black', 'White', 'Silver', 'Gray', 'Grey', 'Red', 'Blue', 'Green',
  'Yellow', 'Orange', 'Brown', 'Beige', 'Gold', 'Purple', 'Pink',
  'Maroon', 'Navy', 'Cyan', 'Turquoise', 'Charcoal', 'Burgundy',
];

export const ALGERIA_WILAYA_CODES = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38', '39', '40',
  '41', '42', '43', '44', '45', '46', '47', '48', '49', '50',
  '51', '52', '53', '54', '55', '56', '57', '58'
];

export const validateBrand = (brand) => {
  if (!brand || brand.trim() === '') {
    return 'Brand is required';
  }
  
  if (brand.trim().length < 2) {
    return 'Brand must be at least 2 characters';
  }
  
  const normalizedInput = brand.trim().toLowerCase();
  const isValid = VALID_CAR_BRANDS.some(
    validBrand => validBrand.toLowerCase() === normalizedInput
  );
  
  if (!isValid) {
    return 'Please select a valid car brand from the list';
  }
  
  return '';
};

export const validateModel = (model, brand) => {

  if (!model || model.trim() === '') {
    return '';
  }
  
  if (model.trim().length < 1) {
    return 'Model must be at least 1 character';
  }
  
  if (!/^[a-zA-Z0-9\s-]+$/.test(model)) {
    return 'Model must contain only letters and numbers';
  }
  
  // Si la marque est fournie et valide, vérifier que le modèle existe pour cette marque
  if (brand && brand.trim() !== '') {
    const normalizedBrand = brand.trim();
    const brandModels = CAR_BRANDS_WITH_MODELS[normalizedBrand];
    
    if (brandModels) {
      const normalizedModel = model.trim().toLowerCase();
      const isValidModel = brandModels.some(
        validModel => validModel.toLowerCase() === normalizedModel
      );
      
      if (!isValidModel) {
        return `Please select a valid model for ${normalizedBrand}`;
      }
    }
  }
  
  return '';
};

export const validateYear = (year) => {

  if (!year || year.trim() === '') {
    return '';
  }
  
  const yearNum = Number(year);
  const currentYear = new Date().getFullYear();
  
  if (isNaN(yearNum)) {
    return 'Year must be a number';
  }
  
  if (yearNum < 1900 || yearNum > currentYear + 1) {
    return `Year must be between 1900 and ${currentYear + 1}`;
  }
  
  return '';
};

export const validateSeats = (seats) => {

  if (!seats || seats.trim() === '') {
    return '';
  }
  
  const seatsNum = Number(seats);
  
  if (isNaN(seatsNum)) {
    return 'Seats must be a number';
  }
  
  if (seatsNum < 1 || seatsNum > 9) {
    return 'Seats must be between 1 and 9';
  }
  
  return '';
};

/**
 * Valider la plaque d'immatriculation algérienne pour application de covoiturage
 * Format strict: XXXXX 1ZZ WW
 * - XXXXX: Numéro de série (5 chiffres obligatoires avec zéros de tête)
 * - 1: Type de véhicule (DOIT être 1 pour transport de passagers)
 * - ZZ: Année du véhicule (2 chiffres)
 * - WW: Code wilaya (2 chiffres: 01-58)
 */
export const validateLicensePlate = (plate, vehicleYear = null) => {

  if (!plate || plate.trim() === '') {
    return '';
  }
  
  const cleanPlate = plate.trim();
  
  const plateWithoutSeparators = cleanPlate.replace(/[\s-]/g, '');
 
  if (!/^\d+$/.test(plateWithoutSeparators)) {
    return 'License plate must contain only numbers';
  }

  if (plateWithoutSeparators.length !== 10) {
    return 'Format: XXXXX 1ZZ WW (10 digits required)';
  }
  
  const serialNumber = plateWithoutSeparators.slice(0, 5);   
  const typeAndYear = plateWithoutSeparators.slice(5, 8);    
  const wilayaCode = plateWithoutSeparators.slice(8, 10);   
  
  // Valider le code wilaya (doit être entre 01 et 58)
  const wilayaNum = parseInt(wilayaCode);
  if (wilayaNum < 1 || wilayaNum > 58 || !ALGERIA_WILAYA_CODES.includes(wilayaCode)) {
    return 'Invalid wilaya code (must be 01-58)';
  }
  
  // Valider le type de véhicule (DOIT ÊTRE 1 pour transport de passagers)
  const vehicleType = parseInt(typeAndYear[0]);
  if (vehicleType !== 1) {
    return 'Only passenger transport vehicles allowed (type must be 1)';
  }
  
  // Extraire l'année de la plaque (2 derniers chiffres de typeAndYear)
  const plateYear = parseInt(typeAndYear.slice(1));
  if (plateYear < 0 || plateYear > 99) {
    return 'Invalid year in plate';
  }
  
  // Validation croisée avec l'année du véhicule si fournie
  if (vehicleYear && vehicleYear.trim() !== '') {
    const fullVehicleYear = parseInt(vehicleYear);
    const vehicleYearShort = fullVehicleYear % 100; 
    
    if (plateYear !== vehicleYearShort) {
      return `Year mismatch: plate shows '${plateYear}' but vehicle year is '${vehicleYearShort}'`;
    }
  }

  if (cleanPlate.includes('-') || cleanPlate.includes(' ')) {
    const separator = cleanPlate.includes('-') ? '-' : ' ';
    const expectedFormat = `${serialNumber}${separator}${typeAndYear}${separator}${wilayaCode}`;
    
    if (cleanPlate !== expectedFormat) {
      return `Format: XXXXX${separator}1ZZ${separator}WW (e.g., 02639${separator}126${separator}09)`;
    }
  }
  
  return '';
};

export const validateColor = (color) => {
  // Color is optional
  if (!color || color.trim() === '') {
    return '';
  }
  
  if (color.trim().length < 3) {
    return 'Color must be at least 3 characters';
  }
  
  if (!/^[a-zA-Z\s-]+$/.test(color)) {
    return 'Color must contain only letters';
  }
  
  const normalizedInput = color.trim().toLowerCase();
  const isValid = VALID_COLORS.some(
    validColor => validColor.toLowerCase() === normalizedInput
  );
  
  if (!isValid) {
    return 'Please select a valid color from the list';
  }
  
  return '';
};

export const getModelsForBrand = (brand) => {
  if (!brand || brand.trim() === '') {
    return [];
  }
  
  return CAR_BRANDS_WITH_MODELS[brand.trim()] || [];
};

export const validateAllVehicleFields = (vehicleData) => {
  return {
    marque: validateBrand(vehicleData.marque),
    modele: validateModel(vehicleData.modele, vehicleData.marque),
    annee: validateYear(vehicleData.annee),
    nbPlaces: validateSeats(vehicleData.nbPlaces),
    plaque: validateLicensePlate(vehicleData.plaque, vehicleData.annee),
    couleur: validateColor(vehicleData.couleur),
  };
};

export const formatLicensePlateInput = (input, separator = ' ') => {
  if (!input) return '';
  
  const digitsOnly = input.replace(/\D/g, '');
  
  const limited = digitsOnly.slice(0, 10);
  
  let formatted = '';
  
  if (limited.length <= 5) {

    formatted = limited;
  } else if (limited.length <= 8) {

    formatted = limited.slice(0, 5) + separator + limited.slice(5);
  } else {
 
    formatted = limited.slice(0, 5) + separator + limited.slice(5, 8) + separator + limited.slice(8);
  }
  
  return formatted;
};

export const formatAlgerianPlate = (plate) => {
  if (!plate) return '';
  
  const clean = plate.replace(/[\s-]/g, '');

  if (!/^\d{10}$/.test(clean)) {
    return plate;
  }
  
  const serial = clean.slice(0, 5);
  const typeYear = clean.slice(5, 8);
  const wilaya = clean.slice(8, 10);
  
  return `${serial} ${typeYear} ${wilaya}`;
};


export const extractYearFromPlate = (plate) => {
  if (!plate) return null;
  
  const clean = plate.replace(/[\s-]/g, '');
  if (clean.length !== 10) return null;
  
  const yearShort = parseInt(clean.slice(6, 8));
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  
  const fullYear = currentCentury + yearShort;
  
  if (fullYear > currentYear + 1) {
    return fullYear - 100;
  }
  
  return fullYear;
};

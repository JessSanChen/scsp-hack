import type { InfraFeature } from './mapTypes';

export const INFRA_FALLBACK: InfraFeature[] = [
  // Hospitals
  { id: 'h1', type: 'hospital', lat: 25.043, lng: 121.519, name: 'NTU Hospital' },
  { id: 'h2', type: 'hospital', lat: 25.050, lng: 121.537, name: 'Taipei Veterans General' },
  { id: 'h3', type: 'hospital', lat: 25.033, lng: 121.560, name: 'Taipei Medical Univ. Hospital' },
  { id: 'h4', type: 'hospital', lat: 25.016, lng: 121.454, name: 'New Taipei Municipal Hospital' },
  { id: 'h5', type: 'hospital', lat: 24.990, lng: 121.308, name: 'Taoyuan General Hospital' },
  { id: 'h6', type: 'hospital', lat: 24.805, lng: 120.970, name: 'Hsinchu Mackay Hospital' },
  { id: 'h7', type: 'hospital', lat: 24.145, lng: 120.680, name: 'China Medical Univ. Hospital' },
  { id: 'h8', type: 'hospital', lat: 24.138, lng: 120.694, name: 'Taichung Veterans General' },
  { id: 'h9', type: 'hospital', lat: 23.479, lng: 120.450, name: 'Buddhist Dalin Hospital' },
  { id: 'h10', type: 'hospital', lat: 22.993, lng: 120.185, name: 'NCKU Hospital Tainan' },
  { id: 'h11', type: 'hospital', lat: 23.025, lng: 120.225, name: 'Chi Mei Hospital Tainan' },
  { id: 'h12', type: 'hospital', lat: 22.639, lng: 120.280, name: 'Kaohsiung Medical Univ. Hospital' },
  { id: 'h13', type: 'hospital', lat: 22.688, lng: 120.302, name: 'Kaohsiung Veterans General' },
  { id: 'h14', type: 'hospital', lat: 22.635, lng: 120.330, name: 'Chang Gung Memorial Kaohsiung' },
  { id: 'h15', type: 'hospital', lat: 24.142, lng: 121.649, name: 'Hualien Tzu Chi Hospital' },

  // Schools (major universities as proxy)
  { id: 's1', type: 'school', lat: 25.017, lng: 121.539, name: 'National Taiwan University' },
  { id: 's2', type: 'school', lat: 25.021, lng: 121.526, name: 'National Taiwan Normal Univ.' },
  { id: 's3', type: 'school', lat: 25.075, lng: 121.577, name: 'National Taipei Univ. of Tech.' },
  { id: 's4', type: 'school', lat: 24.179, lng: 120.649, name: 'National Chung Hsing Univ.' },
  { id: 's5', type: 'school', lat: 22.993, lng: 120.222, name: 'National Cheng Kung Univ.' },
  { id: 's6', type: 'school', lat: 22.630, lng: 120.270, name: 'National Sun Yat-sen Univ.' },
  { id: 's7', type: 'school', lat: 24.796, lng: 120.993, name: 'National Tsing Hua Univ.' },
  { id: 's8', type: 'school', lat: 24.787, lng: 120.997, name: 'National Chiao Tung Univ.' },
  { id: 's9', type: 'school', lat: 24.988, lng: 121.310, name: 'National Central Univ.' },
  { id: 's10', type: 'school', lat: 24.145, lng: 120.673, name: 'Tunghai University' },

  // Power (plants & substations)
  { id: 'p1', type: 'power', lat: 25.209, lng: 121.602, name: 'Jinshan Nuclear Power Plant' },
  { id: 'p2', type: 'power', lat: 22.550, lng: 120.448, name: 'Maanshan Nuclear Power Plant' },
  { id: 'p3', type: 'power', lat: 22.858, lng: 120.200, name: 'Hsinta Power Station' },
  { id: 'p4', type: 'power', lat: 25.102, lng: 121.352, name: 'Linkou Power Station' },
  { id: 'p5', type: 'power', lat: 24.988, lng: 121.450, name: 'Longtan Substation (345kV)' },
  { id: 'p6', type: 'power', lat: 24.142, lng: 120.540, name: 'Taichung Power Plant' },
  { id: 'p7', type: 'power', lat: 23.487, lng: 120.297, name: 'Wushe Hydroelectric' },
  { id: 'p8', type: 'power', lat: 22.698, lng: 120.512, name: 'Pingtung Substation' },
  { id: 'p9', type: 'power', lat: 25.088, lng: 121.843, name: 'Keelung Power Station' },
  { id: 'p10', type: 'power', lat: 24.145, lng: 121.647, name: 'Hualien Substation (161kV)' },
];

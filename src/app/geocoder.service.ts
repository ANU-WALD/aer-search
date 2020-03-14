import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

const ENDPOINT='https://maps.googleapis.com/maps/api/geocode/json';
// const PLACES_ENDPOINT='https://maps.googleapis.com/maps/api/place/findplacefromtext/json';

export interface GeocodingResult {
  formatted_address:string;
  geometry: {
    location: {
      lat:number;
      lng:number;
    }
  };
}

@Injectable({
  providedIn: 'root'
})
export class GeocoderService {

  constructor(private http:HttpClient) {

  }

  getCoordinates(address:string):Observable<GeocodingResult[]>{
    let url=`${ENDPOINT}?address=${address}&components=country:AU&key=${environment.google_maps_api_key}`;

    // let url = `${PLACES_ENDPOINT}?query=${address}&region=AU&key=${environment.google_maps_api_key}`;
    return this.http.get(url).pipe(
      map((data:any)=>data.results as GeocodingResult[]));
  }
}

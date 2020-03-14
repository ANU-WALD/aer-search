import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { GeocoderService } from './geocoder.service';
import { Subscription } from 'rxjs';

const DEBOUNCE_TIME=50;

interface SimpleFeature {
  north:number;
  south:number;
  east:number;
  west:number;
  [key: string]: string | number;
}

interface LayerDescription {
  name: string;
  description: string;
  source: string;
  labelField: string;
  keyField: string;
  features: SimpleFeature[];
}

interface Location{
  lat:number;
  lng:number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  layers: LayerDescription[] = [];
  selectedLayer: LayerDescription;
  selectedFeature: SimpleFeature;
  address: string;
  geocodingSubscription: Subscription;
  debounce:number=null;

  location:Location = null;
  matchedAddress: string;
  matchedReports:string[];

  constructor(private _http: HttpClient, private geocoder:GeocoderService) {
    this._http.get(`${environment.config}?_t=${(new Date().getTime())}`).subscribe((data: LayerDescription[]) => {
      this.layers = data;
      this.selectedLayer = data[0];
      this.layerChange();
      this.selectedFeature = data[0].features[0];
      this.matchReports();
    });

    this.geocoder.getCoordinates('5 Mockridge Crescent, Holt').subscribe(data=>{
      console.log(data);
    });
  }

  layerChange() {
    const nmField = this.selectedLayer.labelField;
    this.selectedLayer.features.sort((a, b) => a[nmField] < b[nmField] ? -1 : 1);
    this.selectedFeature = this.selectedLayer.features[0];
    this.updateURL();
  }

  featureChange() {
    this.updateURL();
  }

  addressChange() {
    if(this.debounce!==null){
      clearTimeout(this.debounce);
      this.debounce = null;
    }

    this.debounce = window.setTimeout(()=>{
      if(this.geocodingSubscription){
        this.geocodingSubscription.unsubscribe();
        this.geocodingSubscription = null;
      }
      console.log(this.address);
      if(this.address&&(this.address.length>4)){
        this.geocodingSubscription = this.geocoder.getCoordinates(this.address).subscribe(res=>{
          console.log(res);
          this.geocodingSubscription = null;

          if(!res.length){
            return;
          }
          this.matchedAddress = res[0].formatted_address;
          this.location = res[0].geometry.location;
          this.matchReports();
        });
      }
    },DEBOUNCE_TIME);
  }

  updateURL() {

  }

  useLocation() {
    navigator.geolocation.getCurrentPosition(pos=>{
      console.log(pos);
      const coords = pos&&pos.coords;
      if(!coords){
        return;
      }
      this.matchedAddress = `${coords.latitude}, ${coords.longitude}`;
      this.location = {
        lat:coords.latitude,
        lng:coords.longitude
      };
      this.matchReports();
    }, error=>{
      console.log(error);
    });
  }

  matchReports(){
    if(!this.location||!this.layers){
      return;
    }
    this.matchedReports = [];
    this.layers.forEach(layer=>{
      const matchingFeatures = layer.features.filter(f=>this.featureContains(f,this.location));
      this.matchedReports = this.matchedReports.concat(matchingFeatures.map(f=>{
        return `${layer.name}: ${f[layer.labelField]}`;
      }));
    });
  }

  private featureContains(f:SimpleFeature,location:Location):boolean{
    return location.lat>=f.south &&
           location.lat <= f.north &&
           location.lng >= f.west &&
           location.lng <= f.east;
  }
}

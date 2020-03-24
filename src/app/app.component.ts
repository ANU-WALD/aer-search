import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { GeocoderService } from './geocoder.service';
import { Subscription, Observable, of } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, switchAll, publishReplay, refCount } from 'rxjs/operators';

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

interface Report {
  label:string;
  url:string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  layers$: Observable<LayerDescription[]>;
  layers: LayerDescription[] = [];
  selectedLayer: LayerDescription;
  selectedFeature: SimpleFeature;
  address: string;
  geocodingSubscription: Subscription;
  debounce:number=null;

  location:Location = null;
  matchedAddress: string;
  matchedReports:Report[];
  selectedReport: string | Report;

  get url():string{
    return this.selectedReport&&(this.selectedReport as any).url;
  }

  constructor(private _http: HttpClient, private geocoder:GeocoderService) {
    const url = `${environment.config}?_t=${(new Date().getTime())}`;
    this.layers$ = this._http.get(url).pipe(
      map((d:LayerDescription[])=>d),
      publishReplay(),
      refCount());

    this.layers$.subscribe((data: LayerDescription[]) => {
      this.layers = data;
      this.selectedLayer = data[0];
      this.layerChange();
      this.selectedFeature = data[0].features[0];
      this.matchReports();
    });
  }

  layerChange() {
    const nmField = this.selectedLayer.labelField;
    this.selectedLayer.features.sort((a, b) => a[nmField] < b[nmField] ? -1 : 1);
    this.selectedFeature = this.selectedLayer.features[0];
    this.updateURL();
  }

  // featureChange() {
  //   this.updateURL();
  // }

  addressChange() {
    if(this.debounce!==null){
      clearTimeout(this.debounce);
      this.debounce = null;
    }

    this.matchedAddress = null;
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
    this.selectedReport = this.makeReport(this.selectedLayer,this.selectedFeature);
  }

  makeURL(layer:LayerDescription,feature:SimpleFeature):string{
    const base='http://wenfo.org/aer_pdf';
    return `${base}/${layer.source}/${feature[layer.labelField]}.pdf`;
  }

  makeReport(lyr:LayerDescription,feature:SimpleFeature):Report{
    return {
      label: `${feature[lyr.labelField]} (${lyr.name})`,
      url: this.makeURL(lyr,feature)
    };
  }

  useLocation() {
    this.address = null;
    this.matchedAddress = null;
    this.selectedReport = null;
    navigator.geolocation.getCurrentPosition(pos=>{
      const coords = pos&&pos.coords;
      if(!coords){
        return;
      }
      this.matchedAddress =
        `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;

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
      this.matchedReports = this.matchedReports.concat(
        matchingFeatures.map(f=>this.makeReport(layer,f)));
    });
  }

  matchReportsByLocation(loc:Location):Observable<Report[]>{
    return this.layers$.pipe(
      map(layers=>{
        return layers.map(lyr=>{
          return lyr.features.filter(f=>{
            return this.featureContains(f,this.location);
          }).map(f=>this.makeReport(lyr,f))
        });
      }),
      map(reportsByLayer=>([] as Report[]).concat(...reportsByLayer)));
  }

  matchReportsByName(txt:string):Observable<Report[]>{
    txt = txt.toLowerCase();
    return this.layers$.pipe(
      map(layers=>{
        return layers.map(lyr=>{
          return lyr.features.filter(f=>{
            const lbl = f[lyr.labelField]&&f[lyr.labelField].toString().toLowerCase();
            return lbl.indexOf(txt)>=0;
          }).map(f=>this.makeReport(lyr,f));
        });
      }),
      map(reportsByLayer=>([] as Report[]).concat(...reportsByLayer)));
  }

  private featureContains(f:SimpleFeature,location:Location):boolean{
    return location.lat>=f.south &&
           location.lat <= f.north &&
           location.lng >= f.west &&
           location.lng <= f.east;
  }

  search = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      map(term => {
        if(term.length < 2){
          return of([]);
        }
        let matches$ = this.matchReportsByName(term);
        if(term.length < 4){
          return matches$;
        }

        const geocoding$ = this.geocoder.getCoordinates(this.address).pipe(
          map(loc=>loc[0])
        );

        return matches$;
      }),
      switchAll()
    );

  reportFormatter = (r:Report) => r.label;

  onNavChange(){
    this.selectedReport = null;
  }
}

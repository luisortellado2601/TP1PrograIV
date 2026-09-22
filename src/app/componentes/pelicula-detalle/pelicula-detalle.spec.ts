import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PeliculaDetalle } from './pelicula-detalle';

describe('PeliculaDetalle', () => {
  let component: PeliculaDetalle;
  let fixture: ComponentFixture<PeliculaDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PeliculaDetalle],
    }).compileComponents();

    fixture = TestBed.createComponent(PeliculaDetalle);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

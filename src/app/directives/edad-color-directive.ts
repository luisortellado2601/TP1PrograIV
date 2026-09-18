import { Directive, ElementRef, Input, OnChanges } from '@angular/core';

@Directive({
  selector: '[appEdadColor]',
  standalone: true
})
export class EdadColorDirective implements OnChanges {
  @Input('appEdadColor') edad!: string;

  constructor(private el: ElementRef) {}

  ngOnChanges() {
    let color = '#718096'; // Gris por defecto

    if (this.edad === 'ATP') color = '#16a34a'; // Verde
    if (this.edad === '+13' || this.edad === '+16') color = '#ca8a04'; // Naranja
    if (this.edad === '+18') color = '#dc2626'; // Rojo

    this.el.nativeElement.style.color = color;
    this.el.nativeElement.style.fontWeight = 'bold';
  }
}